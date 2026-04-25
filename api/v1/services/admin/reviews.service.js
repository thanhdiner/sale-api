const mongoose = require('mongoose')
const reviewRepository = require('../../repositories/review.repository')
const reviewVoteRepository = require('../../repositories/reviewVote.repository')
const AppError = require('../../utils/AppError')
const { getRequesterUserId, recalcProductRating } = require('../../utils/reviewUtils')

function ensureValidObjectId(id, message = 'Invalid review ID') {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(message, 400)
  }
}

async function getReviewByIdOrThrow(reviewId) {
  ensureValidObjectId(reviewId)

  const review = await reviewRepository.findOne({ _id: reviewId, deleted: false })
  if (!review) {
    throw new AppError('Review not found', 404)
  }

  return review
}

async function listReviews(params = {}) {
  const { page = 1, limit = 20, productId, hidden, rating } = params
  const query = { deleted: false }

  if (productId) {
    ensureValidObjectId(productId, 'Invalid product ID')
    query.productId = productId
  }

  if (hidden === 'true') query.hidden = true
  if (hidden === 'false') query.hidden = { $ne: true }
  if (rating) query.rating = Number(rating)

  const skip = (Number(page) - 1) * Number(limit)
  const total = await reviewRepository.countByQuery(query)
  const reviews = await reviewRepository.find(query, {
    sort: { createdAt: -1 },
    skip,
    limit: Number(limit),
    populate: [
      { path: 'userId', select: 'fullName avatarUrl username email' },
      { path: 'productId', select: 'title thumbnail slug' },
      { path: 'hiddenBy', select: 'fullName username' }
    ]
  })

  return { reviews, total }
}

async function replyReview(reviewId, content) {
  const review = await getReviewByIdOrThrow(reviewId)
  review.sellerReply = { content: content || '', repliedAt: new Date() }
  await review.save()

  return { sellerReply: review.sellerReply }
}

async function deleteReply(reviewId) {
  const review = await getReviewByIdOrThrow(reviewId)
  review.sellerReply = { content: '', repliedAt: null }
  await review.save()

  return { message: 'Reply deleted' }
}

async function hideReview(reviewId, payload = {}, user = null) {
  const review = await getReviewByIdOrThrow(reviewId)
  const { reason = '' } = payload || {}

  review.hidden = true
  review.hiddenAt = new Date()
  review.hiddenBy = getRequesterUserId(user) || null
  review.hiddenReason = reason || review.hiddenReason || ''
  await review.save()

  await recalcProductRating(review.productId)

  return { message: 'Review hidden', review }
}

async function deleteReview(reviewId) {
  const review = await getReviewByIdOrThrow(reviewId)

  review.deleted = true
  review.deletedAt = new Date()
  await review.save()
  await reviewVoteRepository.deleteMany({ reviewId })
  await recalcProductRating(review.productId)

  return { message: 'Deleted' }
}

module.exports = {
  listReviews,
  replyReview,
  deleteReply,
  hideReview,
  deleteReview
}
