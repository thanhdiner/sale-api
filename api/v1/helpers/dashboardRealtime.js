const logger = require('../../../config/logger')
const cache = require('../../../config/redis')
const { getIO } = require('./socket')
const { ROOMS, EVENTS } = require('../socket/constants')
const adminNotificationsService = require('../services/admin/commerce/notifications.service')

const DASHBOARD_CACHE_PATTERN = 'dashboard:*'
const SUMMARY_CACHE_PATTERNS = ['dashboard:summary', 'dashboard:stats:*']

function toOrderPayload(order = {}) {
  return {
    _id: order._id,
    orderCode: order.orderCode,
    contact: order.contact,
    total: order.total,
    status: order.status,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    createdAt: order.createdAt
  }
}

function invalidateDashboardCache(patterns = [DASHBOARD_CACHE_PATTERN]) {
  cache.del(...patterns).catch(err => {
    logger.warn('[Dashboard] Cache invalidation error:', err?.message || String(err))
  })
}

function emitDashboardEvent(event, payload = {}, { invalidate = true, cachePatterns } = {}) {
  if (invalidate) invalidateDashboardCache(cachePatterns)

  try {
    const io = getIO()
    io.to(ROOMS.AGENTS).emit(event, payload)
    io.to(ROOMS.AGENTS).emit(EVENTS.DASHBOARD_INVALIDATED, {
      event,
      affected: payload.affected || [],
      at: new Date().toISOString()
    })
  } catch (err) {
    logger.warn('[Dashboard] Realtime emit skipped:', err?.message || String(err))
  }
}

function emitOrderCreated(order) {
  const payload = {
    order: toOrderPayload(order),
    affected: ['summary', 'statGroup', 'recentOrders', 'lowStockProducts']
  }

  emitDashboardEvent(EVENTS.DASHBOARD_ORDER_CREATED, payload, {
    cachePatterns: [...SUMMARY_CACHE_PATTERNS, 'dashboard:recent-orders:*']
  })

  try {
    getIO().to(ROOMS.AGENTS).emit('new_order', payload.order)
  } catch {}
}

function emitOrderUpdated(order) {
  emitDashboardEvent(EVENTS.DASHBOARD_ORDER_UPDATED, {
    order: toOrderPayload(order),
    affected: ['summary', 'statGroup', 'recentOrders', 'lowStockProducts']
  }, {
    cachePatterns: [...SUMMARY_CACHE_PATTERNS, 'dashboard:recent-orders:*']
  })
}

function emitReviewCreated(review) {
  emitDashboardEvent(EVENTS.DASHBOARD_REVIEW_CREATED, {
    review: {
      _id: review?._id,
      productId: review?.productId,
      rating: review?.rating,
      createdAt: review?.createdAt
    },
    affected: ['summary']
  }, {
    cachePatterns: SUMMARY_CACHE_PATTERNS
  })
}

function emitReviewUpdated(review) {
  emitDashboardEvent(EVENTS.DASHBOARD_REVIEW_UPDATED, {
    review: {
      _id: review?._id,
      productId: review?.productId,
      hidden: review?.hidden,
      deleted: review?.deleted,
      repliedAt: review?.sellerReply?.repliedAt || null
    },
    affected: ['summary']
  }, {
    cachePatterns: SUMMARY_CACHE_PATTERNS
  })
}

function emitProductStockUpdated(productId) {
  const productIds = Array.isArray(productId) ? productId : [productId].filter(Boolean)

  emitDashboardEvent(EVENTS.DASHBOARD_STOCK_UPDATED, {
    productId,
    affected: ['summary', 'statGroup', 'lowStockProducts']
  }, {
    cachePatterns: SUMMARY_CACHE_PATTERNS
  })

  productIds.forEach(id => {
    adminNotificationsService.createAdminNotification({
      type: 'low_stock',
      priority: 'normal',
      title: 'Can kiem tra ton kho',
      message: 'Ton kho san pham vua thay doi, can kiem tra neu sap het hang.',
      targetType: 'product',
      targetId: id,
      actionRequired: false,
      data: { productId: id }
    }).catch(() => {})
  })
}

module.exports = {
  invalidateDashboardCache,
  emitDashboardEvent,
  emitOrderCreated,
  emitOrderUpdated,
  emitReviewCreated,
  emitReviewUpdated,
  emitProductStockUpdated
}
