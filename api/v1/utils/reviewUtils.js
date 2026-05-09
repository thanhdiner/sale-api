const mongoose = require('mongoose')

const orderRepository = require('../repositories/commerce/order.repository')
const productRepository = require('../repositories/product/product.repository')
const reviewRepository = require('../repositories/commerce/review.repository')

const REVIEW_EDIT_LIMIT = 2
const REVIEW_USER_POPULATE = 'fullName avatarUrl username'

const getRequesterUserId = user => user?.userId || user?._id || user?.id || null

const toObjectId = value => (
  value instanceof mongoose.Types.ObjectId ? value : new mongoose.Types.ObjectId(value)
)

const serializeReview = (review, { currentUserId = null, votedSet = new Set() } = {}) => {
  const reviewObject = review?.toObject ? review.toObject() : review
  const ownerId = reviewObject?.userId?._id || reviewObject?.userId
  const ownerIdString = ownerId ? ownerId.toString() : ''
  const currentUserIdString = currentUserId ? currentUserId.toString() : ''
  const isOwner = !!currentUserIdString && ownerIdString === currentUserIdString
  const editCount = Number(reviewObject?.editCount || 0)

  return {
    ...reviewObject,
    isVoted: reviewObject?._id ? votedSet.has(reviewObject._id.toString()) : false,
    isOwner,
    canEdit: isOwner && editCount < REVIEW_EDIT_LIMIT,
    editsRemaining: Math.max(0, REVIEW_EDIT_LIMIT - editCount)
  }
}

const recalcProductRating = async productId => {
  const all = await reviewRepository.find(
    { productId, deleted: false, hidden: { $ne: true } },
    { select: 'rating' }
  )
  const avg = all.length ? all.reduce((sum, review) => sum + review.rating, 0) / all.length : 0

  const product = await productRepository.findById(productId)
  if (product) {
    product.rate = all.length ? Math.round(avg * 10) / 10 : 0
    await product.save()
  }
}

const getReviewEligibility = async ({ productId, userId }) => {
  const normalizedProductId = toObjectId(productId)

  if (!userId) {
    return {
      isLoggedIn: false,
      state: 'login_required',
      canCreate: false,
      hasPurchased: false,
      hasCompletedOrder: false,
      orderId: null,
      orderStatus: null,
      myReview: null
    }
  }

  const myReview = await reviewRepository.findOne({
    productId: normalizedProductId,
    userId,
    deleted: false
  }, {
    populate: { path: 'userId', select: REVIEW_USER_POPULATE }
  })

  const completedOrder = await orderRepository.findOne({
    userId,
    isDeleted: false,
    status: 'completed',
    'orderItems.productId': normalizedProductId
  })

  const latestOrder = completedOrder || await orderRepository.findOne({
    userId,
    isDeleted: false,
    'orderItems.productId': normalizedProductId
  })


  const hasPurchased = !!latestOrder
  const hasCompletedOrder = !!completedOrder

  if (myReview) {
    return {
      isLoggedIn: true,
      state: 'already_reviewed',
      canCreate: false,
      hasPurchased,
      hasCompletedOrder,
      orderId: myReview.orderId || completedOrder?._id || latestOrder?._id || null,
      orderStatus: latestOrder?.status || null,
      myReview
    }
  }

  if (!hasPurchased) {
    return {
      isLoggedIn: true,
      state: 'not_purchased',
      canCreate: false,
      hasPurchased: false,
      hasCompletedOrder: false,
      orderId: null,
      orderStatus: null,
      myReview: null
    }
  }

  if (!hasCompletedOrder) {
    return {
      isLoggedIn: true,
      state: 'order_not_completed',
      canCreate: false,
      hasPurchased: true,
      hasCompletedOrder: false,
      orderId: latestOrder?._id || null,
      orderStatus: latestOrder?.status || null,
      myReview: null
    }
  }

  return {
    isLoggedIn: true,
    state: 'can_review',
    canCreate: true,
    hasPurchased: true,
    hasCompletedOrder: true,
    orderId: completedOrder?._id || null,
    orderStatus: completedOrder?.status || null,
    myReview: null
  }
}

module.exports = {
  REVIEW_EDIT_LIMIT,
  REVIEW_USER_POPULATE,
  getRequesterUserId,
  serializeReview,
  recalcProductRating,
  getReviewEligibility
}









