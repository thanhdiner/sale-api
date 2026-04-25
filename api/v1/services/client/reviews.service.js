const mongoose = require('mongoose')
const cloudinary = require('cloudinary').v2
const streamifier = require('streamifier')
const reviewRepository = require('../../repositories/review.repository')
const reviewVoteRepository = require('../../repositories/reviewVote.repository')
const {
  REVIEW_EDIT_LIMIT,
  REVIEW_USER_POPULATE,
  getRequesterUserId,
  getReviewEligibility,
  recalcProductRating,
  serializeReview
} = require('../../utils/reviewUtils')

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET,
  secure: true
})

const uploadBuffer = (buffer, mimetype) => {
  const folder = mimetype.startsWith('video') ? 'reviews/videos' : 'reviews/images'
  const resourceType = mimetype.startsWith('video') ? 'video' : 'image'

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: resourceType },
      (error, result) => {
        if (result) resolve({ url: result.secure_url, isVideo: mimetype.startsWith('video') })
        else reject(error)
      }
    )

    streamifier.createReadStream(buffer).pipe(stream)
  })
}

const parseJsonArray = value => {
  if (!value) return []

  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const buildSummary = async productObjectId => {
  const summaryAgg = await reviewRepository.aggregate([
    { $match: { productId: productObjectId, deleted: false, hidden: { $ne: true } } },
    { $group: { _id: '$rating', count: { $sum: 1 } } }
  ])

  const ratingDist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  summaryAgg.forEach(item => {
    ratingDist[item._id] = item.count
  })

  const totalCount = Object.values(ratingDist).reduce((sum, count) => sum + count, 0)
  const avgRating = totalCount
    ? Object.entries(ratingDist).reduce((sum, [rating, count]) => sum + Number(rating) * count, 0) / totalCount
    : 0

  return {
    avgRating: Math.round(avgRating * 10) / 10,
    totalCount,
    ratingDist
  }
}

const buildViewerResponse = (viewer, currentUserId) => ({
  ...viewer,
  myReview: viewer.myReview ? serializeReview(viewer.myReview, { currentUserId }) : null
})

const getProductObjectId = productId => {
  if (!mongoose.Types.ObjectId.isValid(productId)) return null
  return new mongoose.Types.ObjectId(productId)
}

async function getReviews({ productId, query = {}, user }) {
  const { sort = 'newest', rating, page = 1, limit = 10 } = query
  const currentUserId = getRequesterUserId(user)
  const productObjectId = getProductObjectId(productId)

  if (!productObjectId) {
    throw { statusCode: 400, message: 'Product không hợp lệ' }
  }

  const viewer = await getReviewEligibility({ productId: productObjectId, userId: currentUserId })

  const reviewQuery = {
    productId: productObjectId,
    deleted: false,
    hidden: { $ne: true }
  }

  if (rating) reviewQuery.rating = Number(rating)
  if (viewer.myReview?._id) reviewQuery._id = { $ne: viewer.myReview._id }

  let sortObj = { createdAt: -1 }
  if (sort === 'helpful') sortObj = { helpfulCount: -1, createdAt: -1 }
  if (sort === 'highRating') sortObj = { rating: -1, createdAt: -1 }
  if (sort === 'lowRating') sortObj = { rating: 1, createdAt: -1 }

  const skip = (Number(page) - 1) * Number(limit)
  const total = await reviewRepository.countByQuery(reviewQuery)
  const reviews = await reviewRepository.find(reviewQuery, {
    sort: sortObj,
    skip,
    limit: Number(limit),
    populate: { path: 'userId', select: REVIEW_USER_POPULATE }
  })

  let votedSet = new Set()
  if (currentUserId && reviews.length > 0) {
    const votes = await reviewVoteRepository.find({
      reviewId: { $in: reviews.map(review => review._id) },
      userId: currentUserId
    })

    votes.forEach(vote => votedSet.add(vote.reviewId.toString()))
  }

  const summary = await buildSummary(productObjectId)

  return {
    reviews: reviews.map(review => serializeReview(review, { currentUserId, votedSet })),
    total,
    summary,
    viewer: buildViewerResponse(viewer, currentUserId)
  }
}

async function createReview({ productId, body = {}, files = [], user }) {
  const currentUserId = getRequesterUserId(user)
  const { rating, title, content } = body
  const productObjectId = getProductObjectId(productId)

  if (!productObjectId) {
    throw { statusCode: 400, message: 'Product không hợp lệ' }
  }

  const viewer = await getReviewEligibility({ productId: productObjectId, userId: currentUserId })

  if (viewer.myReview) throw { statusCode: 409, message: 'Bạn đã đánh giá sản phẩm này rồi' }
  if (!viewer.hasPurchased) throw { statusCode: 403, message: 'Chỉ khách đã mua sản phẩm này mới có thể đánh giá' }
  if (!viewer.hasCompletedOrder) throw { statusCode: 403, message: 'Bạn có thể đánh giá sau khi đơn hàng hoàn tất' }

  const images = []
  const videos = []

  if (files.length) {
    for (const file of files) {
      const result = await uploadBuffer(file.buffer, file.mimetype)
      if (result.isVideo) videos.push(result.url)
      else images.push(result.url)
    }
  }

  const review = await reviewRepository.create({
    productId: productObjectId,
    userId: currentUserId,
    orderId: viewer.orderId,
    rating: Number(rating),
    title: title || '',
    content: content || '',
    images,
    videos,
    editCount: 0
  })

  await review.populate('userId', REVIEW_USER_POPULATE)
  await recalcProductRating(productObjectId)

  const serializedReview = serializeReview(review, { currentUserId })

  return {
    review: serializedReview,
    viewer: {
      ...buildViewerResponse(viewer, currentUserId),
      state: 'already_reviewed',
      canCreate: false,
      orderId: review.orderId,
      myReview: serializedReview
    }
  }
}

async function updateReview({ reviewId, body = {}, files = [], user }) {
  const currentUserId = getRequesterUserId(user)
  const { rating, title, content, keepImages, keepVideos } = body

  const review = await reviewRepository.findOne(
    { _id: reviewId, deleted: false },
    { populate: { path: 'userId', select: REVIEW_USER_POPULATE } }
  )

  if (!review) throw { statusCode: 404, message: 'Review not found' }
  if (review.userId._id.toString() !== currentUserId.toString()) throw { statusCode: 403, message: 'Forbidden' }
  if ((review.editCount || 0) >= REVIEW_EDIT_LIMIT) {
    throw { statusCode: 400, message: 'Bạn chỉ có thể sửa đánh giá tối đa 2 lần' }
  }

  const newImages = parseJsonArray(keepImages)
  const newVideos = parseJsonArray(keepVideos)

  if (files.length) {
    for (const file of files) {
      const result = await uploadBuffer(file.buffer, file.mimetype)
      if (result.isVideo) newVideos.push(result.url)
      else newImages.push(result.url)
    }
  }

  review.rating = Number(rating)
  review.title = title || ''
  review.content = content || ''
  review.images = newImages
  review.videos = newVideos
  review.editCount = (review.editCount || 0) + 1
  await review.save()

  await review.populate('userId', REVIEW_USER_POPULATE)
  await recalcProductRating(review.productId)

  return {
    review: serializeReview(review, { currentUserId })
  }
}

async function deleteReview({ reviewId, user }) {
  const currentUserId = getRequesterUserId(user)
  const review = await reviewRepository.findOne({ _id: reviewId, deleted: false })

  if (!review) throw { statusCode: 404, message: 'Review not found' }
  if (review.userId.toString() !== currentUserId.toString()) throw { statusCode: 403, message: 'Forbidden' }

  const { productId } = review
  review.deleted = true
  review.deletedAt = new Date()
  await review.save()
  await reviewVoteRepository.deleteMany({ reviewId })
  await recalcProductRating(productId)

  return { message: 'Deleted' }
}

async function voteReview({ reviewId, user }) {
  const currentUserId = getRequesterUserId(user)
  const review = await reviewRepository.findOne({ _id: reviewId, deleted: false, hidden: { $ne: true } })

  if (!review) throw { statusCode: 404, message: 'Review not found' }
  if (review.userId.toString() === currentUserId.toString()) {
    throw { statusCode: 403, message: 'Cannot vote your own review' }
  }

  const existing = await reviewVoteRepository.findOne({ reviewId, userId: currentUserId })
  let isVoted

  if (existing) {
    await reviewVoteRepository.deleteOne({ _id: existing._id })
    review.helpfulCount = Math.max(0, review.helpfulCount - 1)
    isVoted = false
  } else {
    await reviewVoteRepository.create({ reviewId, userId: currentUserId })
    review.helpfulCount += 1
    isVoted = true
  }

  await review.save()
  return { helpfulCount: review.helpfulCount, isVoted }
}

module.exports = {
  getReviews,
  createReview,
  updateReview,
  deleteReview,
  voteReview
}
