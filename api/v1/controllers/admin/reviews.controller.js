const Review = require('../../models/review.model')
const logger = require('../../../../config/logger')

// GET /admin/reviews  – list all reviews (paginated, with search & rating filter)
module.exports.getReviews = async (req, res) => {
  try {
    const { page = 1, limit = 20, productId, rating, search } = req.query
    const query = { deleted: false }
    if (productId) query.productId = productId
    if (rating) query.rating = Number(rating)

    const skip = (Number(page) - 1) * Number(limit)
    const total = await Review.countDocuments(query)
    const reviews = await Review.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .populate('userId', 'fullName avatarUrl username email')
      .populate('productId', 'title thumbnail slug')

    // Post-populate search filter
    let filtered = reviews
    if (search && search.trim()) {
      const s = search.trim().toLowerCase()
      filtered = reviews.filter(r =>
        (r.userId?.fullName || '').toLowerCase().includes(s) ||
        (r.userId?.email || '').toLowerCase().includes(s) ||
        (r.content || '').toLowerCase().includes(s) ||
        (r.title || '').toLowerCase().includes(s)
      )
    }

    res.json({ reviews: filtered, total })
  } catch (err) {
    logger.error('[Admin] Reviews error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// PUT /admin/reviews/:reviewId/reply  – seller reply
module.exports.replyReview = async (req, res) => {
  try {
    const { reviewId } = req.params
    const { content } = req.body

    const review = await Review.findOne({ _id: reviewId, deleted: false })
    if (!review) return res.status(404).json({ error: 'Review not found' })

    review.sellerReply = { content: content || '', repliedAt: new Date() }
    await review.save()

    res.json({ sellerReply: review.sellerReply })
  } catch (err) {
    logger.error('[Admin] Reviews error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// DELETE /admin/reviews/:reviewId/reply
module.exports.deleteReply = async (req, res) => {
  try {
    const { reviewId } = req.params
    const review = await Review.findOne({ _id: reviewId, deleted: false })
    if (!review) return res.status(404).json({ error: 'Review not found' })

    review.sellerReply = { content: '', repliedAt: null }
    await review.save()

    res.json({ message: 'Reply deleted' })
  } catch (err) {
    logger.error('[Admin] Reviews error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// DELETE /admin/reviews/:reviewId  – admin force delete
module.exports.deleteReview = async (req, res) => {
  try {
    const { reviewId } = req.params
    const review = await Review.findOne({ _id: reviewId, deleted: false })
    if (!review) return res.status(404).json({ error: 'Review not found' })

    review.deleted = true
    review.deletedAt = new Date()
    await review.save()

    res.json({ message: 'Deleted' })
  } catch (err) {
    logger.error('[Admin] Reviews error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}
