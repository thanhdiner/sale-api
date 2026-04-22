const Review = require('../../models/review.model')
const ReviewVote = require('../../models/reviewVote.model')
const { getRequesterUserId, recalcProductRating } = require('../../utils/reviewUtils')

// GET /admin/reviews
module.exports.getReviews = async (req, res) => {
  try {
    const { page = 1, limit = 20, productId, hidden, rating } = req.query
    const query = { deleted: false }

    if (productId) query.productId = productId
    if (hidden === 'true') query.hidden = true
    if (hidden === 'false') query.hidden = { $ne: true }
    if (rating) query.rating = Number(rating)

    const skip = (Number(page) - 1) * Number(limit)
    const total = await Review.countDocuments(query)
    const reviews = await Review.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .populate('userId', 'fullName avatarUrl username email')
      .populate('productId', 'title thumbnail slug')
      .populate('hiddenBy', 'fullName username')

    res.json({ reviews, total })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// PUT /admin/reviews/:reviewId/reply
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
    console.error(err)
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
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// PUT /admin/reviews/:reviewId/hide
module.exports.hideReview = async (req, res) => {
  try {
    const { reviewId } = req.params
    const { reason = '' } = req.body || {}

    const review = await Review.findOne({ _id: reviewId, deleted: false })
    if (!review) return res.status(404).json({ error: 'Review not found' })

    review.hidden = true
    review.hiddenAt = new Date()
    review.hiddenBy = getRequesterUserId(req.user) || null
    review.hiddenReason = reason || review.hiddenReason || ''
    await review.save()

    await recalcProductRating(review.productId)

    res.json({ message: 'Review hidden', review })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// DELETE /admin/reviews/:reviewId
module.exports.deleteReview = async (req, res) => {
  try {
    const { reviewId } = req.params
    const review = await Review.findOne({ _id: reviewId, deleted: false })
    if (!review) return res.status(404).json({ error: 'Review not found' })

    review.deleted = true
    review.deletedAt = new Date()
    await review.save()
    await ReviewVote.deleteMany({ reviewId })

    await recalcProductRating(review.productId)

    res.json({ message: 'Deleted' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
}
