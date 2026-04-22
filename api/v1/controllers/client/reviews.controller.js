const mongoose = require('mongoose')
const cloudinary = require('cloudinary').v2
const streamifier = require('streamifier')

const Review = require('../../models/review.model')
const ReviewVote = require('../../models/reviewVote.model')
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
  const summaryAgg = await Review.aggregate([
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

// GET /reviews/:productId
module.exports.getReviews = async (req, res) => {
  try {
    const { productId } = req.params
    const { sort = 'newest', rating, page = 1, limit = 10 } = req.query
    const currentUserId = getRequesterUserId(req.user)
    const productObjectId = getProductObjectId(productId)

    if (!productObjectId) {
      return res.status(400).json({ error: 'Product không hợp lệ' })
    }

    const viewer = await getReviewEligibility({ productId: productObjectId, userId: currentUserId })

    const query = {
      productId: productObjectId,
      deleted: false,
      hidden: { $ne: true }
    }

    if (rating) query.rating = Number(rating)
    if (viewer.myReview?._id) query._id = { $ne: viewer.myReview._id }

    let sortObj = { createdAt: -1 }
    if (sort === 'helpful') sortObj = { helpfulCount: -1, createdAt: -1 }
    if (sort === 'highRating') sortObj = { rating: -1, createdAt: -1 }
    if (sort === 'lowRating') sortObj = { rating: 1, createdAt: -1 }

    const skip = (Number(page) - 1) * Number(limit)
    const total = await Review.countDocuments(query)
    const reviews = await Review.find(query)
      .sort(sortObj)
      .skip(skip)
      .limit(Number(limit))
      .populate('userId', REVIEW_USER_POPULATE)

    let votedSet = new Set()
    if (currentUserId && reviews.length > 0) {
      const votes = await ReviewVote.find({
        reviewId: { $in: reviews.map(review => review._id) },
        userId: currentUserId
      })

      votes.forEach(vote => votedSet.add(vote.reviewId.toString()))
    }

    const summary = await buildSummary(productObjectId)

    res.json({
      reviews: reviews.map(review => serializeReview(review, { currentUserId, votedSet })),
      total,
      summary,
      viewer: buildViewerResponse(viewer, currentUserId)
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// POST /reviews/:productId
module.exports.createReview = async (req, res) => {
  try {
    const { productId } = req.params
    const currentUserId = getRequesterUserId(req.user)
    const { rating, title, content } = req.body
    const productObjectId = getProductObjectId(productId)

    if (!productObjectId) {
      return res.status(400).json({ error: 'Product không hợp lệ' })
    }

    const viewer = await getReviewEligibility({ productId: productObjectId, userId: currentUserId })

    if (viewer.myReview) {
      return res.status(409).json({ error: 'Bạn đã đánh giá sản phẩm này rồi' })
    }

    if (!viewer.hasPurchased) {
      return res.status(403).json({ error: 'Chỉ khách đã mua sản phẩm này mới có thể đánh giá' })
    }

    if (!viewer.hasCompletedOrder) {
      return res.status(403).json({ error: 'Bạn có thể đánh giá sau khi đơn hàng hoàn tất' })
    }

    const images = []
    const videos = []

    if (req.files && req.files.length) {
      for (const file of req.files) {
        const result = await uploadBuffer(file.buffer, file.mimetype)
        if (result.isVideo) videos.push(result.url)
        else images.push(result.url)
      }
    }

    const review = await Review.create({
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

    res.status(201).json({
      review: serializedReview,
      viewer: {
        ...buildViewerResponse(viewer, currentUserId),
        state: 'already_reviewed',
        canCreate: false,
        orderId: review.orderId,
        myReview: serializedReview
      }
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// PUT /reviews/:reviewId
module.exports.updateReview = async (req, res) => {
  try {
    const { reviewId } = req.params
    const currentUserId = getRequesterUserId(req.user)
    const { rating, title, content, keepImages, keepVideos } = req.body

    const review = await Review.findOne({ _id: reviewId, deleted: false }).populate('userId', REVIEW_USER_POPULATE)

    if (!review) return res.status(404).json({ error: 'Review not found' })
    if (review.userId._id.toString() !== currentUserId.toString()) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    if ((review.editCount || 0) >= REVIEW_EDIT_LIMIT) {
      return res.status(400).json({ error: 'Bạn chỉ có thể sửa đánh giá tối đa 2 lần' })
    }

    const newImages = parseJsonArray(keepImages)
    const newVideos = parseJsonArray(keepVideos)

    if (req.files && req.files.length) {
      for (const file of req.files) {
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

    res.json({
      review: serializeReview(review, { currentUserId })
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// DELETE /reviews/:reviewId
module.exports.deleteReview = async (req, res) => {
  try {
    const { reviewId } = req.params
    const currentUserId = getRequesterUserId(req.user)

    const review = await Review.findOne({ _id: reviewId, deleted: false })

    if (!review) return res.status(404).json({ error: 'Review not found' })
    if (review.userId.toString() !== currentUserId.toString()) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    const { productId } = review

    review.deleted = true
    review.deletedAt = new Date()
    await review.save()
    await ReviewVote.deleteMany({ reviewId })

    await recalcProductRating(productId)
    res.json({ message: 'Deleted' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// POST /reviews/:reviewId/vote
module.exports.voteReview = async (req, res) => {
  try {
    const { reviewId } = req.params
    const currentUserId = getRequesterUserId(req.user)

    const review = await Review.findOne({ _id: reviewId, deleted: false, hidden: { $ne: true } })

    if (!review) return res.status(404).json({ error: 'Review not found' })
    if (review.userId.toString() === currentUserId.toString()) {
      return res.status(403).json({ error: 'Cannot vote your own review' })
    }

    const existing = await ReviewVote.findOne({ reviewId, userId: currentUserId })
    let isVoted

    if (existing) {
      await ReviewVote.deleteOne({ _id: existing._id })
      review.helpfulCount = Math.max(0, review.helpfulCount - 1)
      isVoted = false
    } else {
      await ReviewVote.create({ reviewId, userId: currentUserId })
      review.helpfulCount += 1
      isVoted = true
    }

    await review.save()

    res.json({ helpfulCount: review.helpfulCount, isVoted })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
}
