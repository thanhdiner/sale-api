const notificationRepository = require('../../../repositories/commerce/notification.repository')
const userRepository = require('../../../repositories/access/user.repository')
const notificationRealtime = require('../../../helpers/notificationRealtime')
const logger = require('../../../../../config/logger')

const NOTIFICATION_CATEGORIES = ['orders', 'payments', 'promotions', 'system', 'support', 'account', 'wishlist', 'reviews', 'chat']
const ORDER_STATUS_LABELS = {
  pending: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  shipping: 'Đang giao hàng',
  completed: 'Hoàn thành',
  cancelled: 'Đã hủy'
}
const PAYMENT_STATUS_LABELS = {
  pending: 'Chưa thanh toán',
  paid: 'Đã thanh toán',
  failed: 'Thanh toán thất bại'
}
const MAX_NOTIFICATION_LIMIT = 50

function cleanString(value, maxLength = 500) {
  if (value == null) return ''
  return String(value).trim().replace(/\s+/g, ' ').slice(0, maxLength)
}

function serializeId(value) {
  if (!value) return ''
  return typeof value.toString === 'function' ? value.toString() : cleanString(value)
}

function normalizeLimit(value, fallback = 10) {
  const normalized = Number(value)
  if (!Number.isInteger(normalized) || normalized < 1) return fallback
  return Math.min(normalized, MAX_NOTIFICATION_LIMIT)
}

function normalizeCategory(value) {
  const normalized = cleanString(value).toLowerCase()
  return NOTIFICATION_CATEGORIES.includes(normalized) ? normalized : ''
}

function normalizeStatusFilter(value) {
  const normalized = cleanString(value).toLowerCase()
  return ['all', 'read', 'unread'].includes(normalized) ? normalized : 'all'
}

function getOrderCode(order = {}) {
  const orderCode = cleanString(order.orderCode)
  if (orderCode) return orderCode.startsWith('#') ? orderCode : `#${orderCode}`

  const id = serializeId(order._id || order.id)
  return id ? `#${id.slice(-8).toUpperCase()}` : ''
}

function buildOrderNotificationPayload(order = {}) {
  const userId = serializeId(order.userId)
  if (!userId) return null

  const orderId = serializeId(order._id || order.id)
  const status = cleanString(order.status)
  const paymentStatus = cleanString(order.paymentStatus)
  const statusLabel = ORDER_STATUS_LABELS[status] || status || 'Cập nhật'
  const paymentStatusLabel = PAYMENT_STATUS_LABELS[paymentStatus] || paymentStatus || ''
  const code = getOrderCode(order)
  const isPaymentUpdate = paymentStatus === 'paid' || paymentStatus === 'failed'

  return {
    userId,
    type: isPaymentUpdate ? 'payment_status_updated' : 'order_status_updated',
    category: isPaymentUpdate ? 'payments' : 'orders',
    title: `Cập nhật đơn hàng ${code}`,
    body: paymentStatusLabel
      ? `Trạng thái đơn: ${statusLabel}. Thanh toán: ${paymentStatusLabel}.`
      : `Trạng thái đơn: ${statusLabel}.`,
    orderId: orderId || null,
    targetType: 'order',
    targetId: orderId,
    data: {
      orderCode: cleanString(order.orderCode) || null,
      status: status || null,
      statusLabel,
      paymentStatus: paymentStatus || null,
      paymentStatusLabel: paymentStatusLabel || null
    }
  }
}

function buildNotificationPayload(payload = {}) {
  return {
    audience: 'client',
    userId: payload.userId,
    type: cleanString(payload.type, 80) || 'system',
    category: normalizeCategory(payload.category) || 'system',
    title: cleanString(payload.title, 180) || 'Thông báo',
    body: cleanString(payload.body, 1000),
    orderId: payload.orderId || null,
    targetType: cleanString(payload.targetType, 80),
    targetId: cleanString(payload.targetId, 120),
    data: payload.data && typeof payload.data === 'object' ? payload.data : {}
  }
}

function preferenceEnabled(preferences = {}, payload = {}) {
  if (preferences?.channels?.inApp === false) return false

  const category = normalizeCategory(payload.category)
  if (category === 'orders' && preferences.orderUpdates === false) return false
  if (category === 'payments' && preferences.paymentUpdates === false) return false
  if (category === 'promotions' && preferences.promotions === false) return false
  if (category === 'wishlist' && preferences.wishlistUpdates === false) return false
  if ((category === 'support' || category === 'chat') && preferences.supportMessages === false) return false
  return true
}

function buildListQuery(userId, filters = {}) {
  const query = { userId, audience: 'client', deletedAt: null, archivedAt: null }
  const status = normalizeStatusFilter(filters.status || (filters.unreadOnly ? 'unread' : 'all'))
  const category = normalizeCategory(filters.category)

  if (status === 'read') query.readAt = { $ne: null }
  if (status === 'unread') query.readAt = null
  if (category) query.category = category

  return query
}

function buildNotificationPayloadForClient(notification = {}) {
  const id = serializeId(notification._id || notification.id)

  return {
    id,
    notificationId: id,
    type: notification.type,
    category: notification.category,
    title: notification.title,
    body: notification.body,
    read: Boolean(notification.readAt),
    readAt: notification.readAt || null,
    orderId: serializeId(notification.orderId) || null,
    targetType: notification.targetType || null,
    targetId: notification.targetId || null,
    data: notification.data || {},
    createdAt: notification.createdAt || null,
    updatedAt: notification.updatedAt || null
  }
}

async function getStats(userId) {
  const query = { userId, audience: 'client', deletedAt: null, archivedAt: null }
  const [total, unread] = await Promise.all([
    notificationRepository.countByQuery(query),
    notificationRepository.countByQuery({ ...query, readAt: null })
  ])

  return { total, unread }
}

async function createNotification(payload = {}) {
  const builtPayload = buildNotificationPayload(payload)
  const user = await userRepository.findById(builtPayload.userId, { select: 'notificationPreferences' })
  if (user && !preferenceEnabled(user.notificationPreferences || {}, builtPayload)) return null

  const notification = await notificationRepository.create(builtPayload)
  notificationRealtime.emitCreated(buildNotificationPayloadForClient(notification), await getStats(builtPayload.userId))
  return notification
}

async function createOrderStatusNotification(order = {}) {
  const payload = buildOrderNotificationPayload(order)
  if (!payload) return null

  try {
    return await createNotification(payload)
  } catch (error) {
    logger.warn(`[Notifications] Failed to create order notification: ${error.message}`)
    return null
  }
}

async function listNotifications(userId, filters = {}) {
  const limit = normalizeLimit(filters.limit)
  const query = buildListQuery(userId, filters)
  const [notifications, totalCount, unreadCount] = await Promise.all([
    notificationRepository.findByQuery(query, {
      sort: { createdAt: -1 },
      limit,
      lean: true
    }),
    notificationRepository.countByQuery(query),
    notificationRepository.countByQuery({ userId, audience: 'client', deletedAt: null, archivedAt: null, readAt: null })
  ])

  return {
    success: true,
    found: notifications.length > 0,
    count: notifications.length,
    totalCount,
    unreadCount,
    notifications: notifications.map(buildNotificationPayloadForClient)
  }
}

async function markNotificationRead(userId, { notificationId, notificationIds, all = false } = {}) {
  const now = new Date()

  if (all === true) {
    const result = await notificationRepository.updateMany(
      { userId, audience: 'client', deletedAt: null, readAt: null },
      { $set: { readAt: now } }
    )
    notificationRealtime.emitRead({ audience: 'client', userId, all: true, stats: await getStats(userId) })

    return {
      success: true,
      all: true,
      modifiedCount: result.modifiedCount || result.nModified || 0
    }
  }

  const ids = Array.isArray(notificationIds)
    ? notificationIds.map(id => cleanString(id)).filter(Boolean)
    : [cleanString(notificationId)].filter(Boolean)

  if (ids.length === 0) {
    const error = new Error('Can cung cap notificationId hoac all=true de danh dau da doc.')
    error.statusCode = 400
    throw error
  }

  if (ids.length === 1) {
    const notification = await notificationRepository.findOneAndUpdate(
      { _id: ids[0], userId, audience: 'client', deletedAt: null },
      { $set: { readAt: now } },
      { lean: true }
    )

    if (!notification) {
      const error = new Error('Khong tim thay thong bao can danh dau da doc.')
      error.statusCode = 404
      throw error
    }

    notificationRealtime.emitRead({ audience: 'client', userId, ids, stats: await getStats(userId) })

    return {
      success: true,
      modifiedCount: 1,
      notification: buildNotificationPayloadForClient(notification)
    }
  }

  const result = await notificationRepository.updateMany(
    { _id: { $in: ids }, userId, audience: 'client', deletedAt: null },
    { $set: { readAt: now } }
  )
  notificationRealtime.emitRead({ audience: 'client', userId, ids, stats: await getStats(userId) })

  return {
    success: true,
    modifiedCount: result.modifiedCount || result.nModified || 0
  }
}

module.exports = {
  createNotification,
  createOrderStatusNotification,
  listNotifications,
  getStats,
  markNotificationRead
}
