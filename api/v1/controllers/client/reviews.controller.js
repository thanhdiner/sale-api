const mongoose = require('mongoose')
const cloudinary = require('cloudinary').v2
const streamifier = require('streamifier')
const logger = require('../../../../config/logger')

const Review = require('../../models/review.model')
const ReviewVote = require('../../models/reviewVote.model')
const Product = require('../../models/products.model')

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET,
  secure: true
})

// Helper: upload a single file buffer to cloudinary
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

// Helper: recalculate product average rating
const recalcProductRating = async productId => {
  const all = await Review.find({ productId, deleted: false }, 'rating')
  const avg = all.length ? all.reduce((s, r) => s + r.rating, 0) / all.length : 0
  await Product.findByIdAndUpdate(productId, { rate: all.length ? Math.round(avg * 10) / 10 : 0 })
}

// GET /reviews/:productId
module.exports.getReviews = async (req, res) => {
  try {
    const { productId } = req.params
    const { sort = 'newest', rating, page = 1, limit = 10 } = req.query
    const userId = req.user?._id

    const query = { productId: new mongoose.Types.ObjectId(productId), deleted: false }
    if (rating) query.rating = Number(rating)

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
      .populate('userId', 'fullName avatarUrl username')

    // Which reviews did the current user vote on?
    let votedSet = new Set()
    if (userId) {
      const votes = await ReviewVote.find({
        reviewId: { $in: reviews.map(r => r._id) },
        userId
      })
      votes.forEach(v => votedSet.add(v.reviewId.toString()))
    }

    // Rating summary (all reviews regardless of page)
    const summaryAgg = await Review.aggregate([
      { $match: { productId: new mongoose.Types.ObjectId(productId), deleted: false } },
      { $group: { _id: '$rating', count: { $sum: 1 } } }
    ])
    const ratingDist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    summaryAgg.forEach(s => {
      ratingDist[s._id] = s.count
    })
    const totalCount = Object.values(ratingDist).reduce((a, b) => a + b, 0)
    const avgRating = totalCount
      ? (Object.entries(ratingDist).reduce((sum, [r, c]) => sum + Number(r) * c, 0) / totalCount).toFixed(1)
      : 0

    res.json({
      reviews: reviews.map(r => ({
        ...r.toObject(),
        isVoted: votedSet.has(r._id.toString()),
        isOwner: !!userId && r.userId._id.toString() === userId.toString()
      })),
      total,
      summary: {
        avgRating: Number(avgRating),
        totalCount,
        ratingDist
      }
    })
  } catch (err) {
    logger.error('[Reviews] error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// POST /reviews/:productId
module.exports.createReview = async (req, res) => {
  try {
    const { productId } = req.params
    const userId = req.user._id
    const { rating, title, content } = req.body

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
      productId,
      userId,
      rating: Number(rating),
      title: title || '',
      content: content || '',
      images,
      videos
    })

    await review.populate('userId', 'fullName avatarUrl username')
    await recalcProductRating(productId)

    res.status(201).json({
      review: { ...review.toObject(), isVoted: false, isOwner: true }
    })
  } catch (err) {
    logger.error('[Reviews] error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// PUT /reviews/:reviewId
module.exports.updateReview = async (req, res) => {
  try {
    const { reviewId } = req.params
    const userId = req.user._id
    const { rating, title, content, keepImages, keepVideos } = req.body

    const review = await Review.findOne({ _id: reviewId, deleted: false })
    if (!review) return res.status(404).json({ error: 'Review not found' })
    if (review.userId.toString() !== userId.toString()) return res.status(403).json({ error: 'Forbidden' })

    const newImages = JSON.parse(keepImages || '[]')
    const newVideos = JSON.parse(keepVideos || '[]')

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
    await review.save()

    await review.populate('userId', 'fullName avatarUrl username')
    await recalcProductRating(review.productId)

    res.json({
      review: { ...review.toObject(), isVoted: false, isOwner: true }
    })
  } catch (err) {
    logger.error('[Reviews] error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// DELETE /reviews/:reviewId
module.exports.deleteReview = async (req, res) => {
  try {
    const { reviewId } = req.params
    const userId = req.user._id

    const review = await Review.findOne({ _id: reviewId, deleted: false })
    if (!review) return res.status(404).json({ error: 'Review not found' })
    if (review.userId.toString() !== userId.toString()) return res.status(403).json({ error: 'Forbidden' })

    const { productId } = review
    review.deleted = true
    review.deletedAt = new Date()
    await review.save()

    await recalcProductRating(productId)
    res.json({ message: 'Deleted' })
  } catch (err) {
    logger.error('[Reviews] error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// POST /reviews/:reviewId/vote  (toggle helpful)
module.exports.voteReview = async (req, res) => {
  try {
    const { reviewId } = req.params
    const userId = req.user._id

    const review = await Review.findOne({ _id: reviewId, deleted: false })
    if (!review) return res.status(404).json({ error: 'Review not found' })
    if (review.userId.toString() === userId.toString())
      return res.status(403).json({ error: 'Cannot vote your own review' })

    const existing = await ReviewVote.findOne({ reviewId, userId })
    let isVoted
    if (existing) {
      await ReviewVote.deleteOne({ _id: existing._id })
      review.helpfulCount = Math.max(0, review.helpfulCount - 1)
      isVoted = false
    } else {
      await ReviewVote.create({ reviewId, userId })
      review.helpfulCount += 1
      isVoted = true
    }
    await review.save()

    res.json({ helpfulCount: review.helpfulCount, isVoted })
  } catch (err) {
    logger.error('[Reviews] error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}
