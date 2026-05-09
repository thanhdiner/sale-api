const mongoose = require('mongoose')
const reviewRepository = require('../../../repositories/commerce/review.repository')
const reviewVoteRepository = require('../../../repositories/commerce/reviewVote.repository')
const AppError = require('../../../utils/AppError')
const { getRequesterUserId, recalcProductRating } = require('../../../utils/reviewUtils')

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

const normalizeLanguage = language => (String(language || '').toLowerCase().startsWith('en') ? 'en' : 'vi')

const hasText = value => typeof value === 'string' && value.trim().length > 0

const toPlainObject = item => {
  if (!item) return item
  return item.toObject ? item.toObject() : { ...item }
}

const buildTextSearch = value => {
  const escapedValue = String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return { $regex: escapedValue, $options: 'i' }
}

function normalizeSellerReplyTranslations(translations = {}) {
  const en = translations?.en || {}

  return {
    en: {
      content: typeof en.content === 'string' ? en.content.trim() : ''
    }
  }
}

function localizeReview(review, languageInput) {
  const language = normalizeLanguage(languageInput)
  const plainReview = toPlainObject(review)

  if (!plainReview) return plainReview

  const product = plainReview.productId && typeof plainReview.productId === 'object'
    ? toPlainObject(plainReview.productId)
    : plainReview.productId
  const translatedProductTitle = language === 'en' ? product?.translations?.en?.title : ''
  const sellerReply = plainReview.sellerReply || {}
  const translatedReplyContent = language === 'en' ? sellerReply.translations?.en?.content : ''

  return {
    ...plainReview,
    productId:
      product && typeof product === 'object'
        ? {
            ...product,
            localizedTitle: hasText(translatedProductTitle) ? translatedProductTitle : product.title
          }
        : product,
    sellerReply: {
      ...sellerReply,
      localizedContent: hasText(translatedReplyContent) ? translatedReplyContent : sellerReply.content
    }
  }
}

async function listReviews(params = {}) {
  const { page = 1, limit = 20, productId, hidden, rating, search, language } = params
  const query = { deleted: false }

  if (productId) {
    ensureValidObjectId(productId, 'Invalid product ID')
    query.productId = productId
  }

  if (hidden === 'true') query.hidden = true
  if (hidden === 'false') query.hidden = { $ne: true }
  if (rating) query.rating = Number(rating)
  if (search?.trim()) {
    const textSearch = buildTextSearch(search.trim())
    query.$or = [
      { title: textSearch },
      { content: textSearch },
      { 'sellerReply.content': textSearch },
      { 'sellerReply.translations.en.content': textSearch }
    ]
  }

  const skip = (Number(page) - 1) * Number(limit)
  const total = await reviewRepository.countByQuery(query)
  const reviews = await reviewRepository.find(query, {
    sort: { createdAt: -1 },
    skip,
    limit: Number(limit),
    populate: [
      { path: 'userId', select: 'fullName avatarUrl username email' },
      { path: 'productId', select: 'title translations thumbnail slug' },
      { path: 'hiddenBy', select: 'fullName username' }
    ]
  })

  return { reviews: reviews.map(review => localizeReview(review, language)), total }
}

async function replyReview(reviewId, payload = {}) {
  const review = await getReviewByIdOrThrow(reviewId)
  const content = typeof payload === 'string' ? payload : payload.content
  const translations = typeof payload === 'string' ? {} : payload.translations

  review.sellerReply = {
    content: content || '',
    translations: normalizeSellerReplyTranslations(translations),
    repliedAt: new Date()
  }
  await review.save()

  return { sellerReply: review.sellerReply }
}

async function deleteReply(reviewId) {
  const review = await getReviewByIdOrThrow(reviewId)
  review.sellerReply = {
    content: '',
    translations: {
      en: {
        content: ''
      }
    },
    repliedAt: null
  }
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












