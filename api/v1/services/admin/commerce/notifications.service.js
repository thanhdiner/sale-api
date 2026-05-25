const mongoose = require('mongoose')
const AppError = require('../../../utils/AppError')
const notificationRepository = require('../../../repositories/commerce/notification.repository')
const notificationRealtime = require('../../../helpers/notificationRealtime')

const ADMIN_TYPES = ['order_created', 'order_cancelled', 'payment_success', 'payment_failed', 'low_stock', 'out_of_stock', 'review_created', 'refund_requested', 'user_registered', 'system_alert']
const TYPE_GROUPS = {
  order_created: 'order',
  order_cancelled: 'order',
  payment_success: 'payment',
  payment_failed: 'payment',
  low_stock: 'inventory',
  out_of_stock: 'inventory',
  review_created: 'review',
  refund_requested: 'refund',
  user_registered: 'user',
  system_alert: 'system'
}
const PRIORITIES = ['high', 'normal', 'low']
const STATUSES = ['all', 'read', 'unread', 'actionRequired']

const cleanString = (value, maxLength = 500) => String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, maxLength)
const serializeId = value => (!value ? '' : typeof value.toString === 'function' ? value.toString() : cleanString(value))

const toPositiveInt = (value, fallback, max = 100) => {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isInteger(parsed) || parsed < 1) return fallback
  return Math.min(parsed, max)
}

const normalizeType = value => {
  const normalized = cleanString(value, 80)
  return ADMIN_TYPES.includes(normalized) ? normalized : ''
}

const normalizePriority = value => {
  const normalized = cleanString(value, 20)
  return PRIORITIES.includes(normalized) ? normalized : ''
}

const normalizeStatus = value => {
  const normalized = cleanString(value, 30)
  return STATUSES.includes(normalized) ? normalized : 'all'
}

const escapeRegex = value => cleanString(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function buildAdminQuery(params = {}) {
  const query = { audience: 'admin', deletedAt: null, archivedAt: null }
  const tab = cleanString(params.tab, 30) || 'all'
  const type = normalizeType(params.type)
  const priority = normalizePriority(params.priority)
  const status = normalizeStatus(params.status)
  const search = cleanString(params.search || params.keyword, 120)

  if (tab === 'unread') query.readAt = null
  if (tab === 'actionRequired') query.actionRequired = true
  if (!['all', 'unread', 'actionRequired'].includes(tab)) {
    const types = ADMIN_TYPES.filter(item => TYPE_GROUPS[item] === tab)
    if (types.length > 0) query.type = { $in: types }
  }

  if (type) query.type = type
  if (priority) query.priority = priority
  if (status === 'read') query.readAt = { $ne: null }
  if (status === 'unread') query.readAt = null
  if (status === 'actionRequired') query.actionRequired = true

  if (search) {
    const regex = new RegExp(escapeRegex(search), 'i')
    query.$or = [{ title: regex }, { body: regex }, { targetId: regex }, { type: regex }, { priority: regex }]
  }

  if (params.startDate || params.endDate) {
    query.createdAt = {}
    if (params.startDate) query.createdAt.$gte = new Date(params.startDate)
    if (params.endDate) query.createdAt.$lte = new Date(params.endDate)
  }

  return query
}

const toAdminPayload = notification => ({
  _id: serializeId(notification._id || notification.id),
  type: notification.type || 'system_alert',
  priority: notification.priority || 'normal',
  title: notification.title || '',
  message: notification.message || notification.body || '',
  body: notification.body || notification.message || '',
  targetType: notification.targetType || '',
  targetId: notification.targetId || '',
  actionRequired: Boolean(notification.actionRequired),
  readAt: notification.readAt || null,
  archivedAt: notification.archivedAt || null,
  deletedAt: notification.deletedAt || null,
  translations: notification.translations || {},
  data: notification.data || {},
  createdAt: notification.createdAt || null,
  updatedAt: notification.updatedAt || null
})

async function getStats(baseQuery = { audience: 'admin', deletedAt: null, archivedAt: null }) {
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)

  const [total, unread, actionRequired, today] = await Promise.all([
    notificationRepository.countByQuery(baseQuery),
    notificationRepository.countByQuery({ ...baseQuery, readAt: null }),
    notificationRepository.countByQuery({ ...baseQuery, actionRequired: true }),
    notificationRepository.countByQuery({ ...baseQuery, createdAt: { $gte: startOfToday } })
  ])

  return { total, unread, actionRequired, today }
}

async function listNotifications(params = {}) {
  const page = toPositiveInt(params.page, 1, 100000)
  const limit = toPositiveInt(params.limit || params.pageSize, 10, 100)
  const query = buildAdminQuery(params)

  const [notifications, total, stats] = await Promise.all([
    notificationRepository.findByQuery(query, { sort: { createdAt: -1 }, skip: (page - 1) * limit, limit, lean: true }),
    notificationRepository.countByQuery(query),
    getStats()
  ])

  return { success: true, notifications: notifications.map(toAdminPayload), total, page, limit, stats }
}

async function createAdminNotification(payload = {}) {
  const notification = await notificationRepository.create({
    audience: 'admin',
    userId: null,
    type: normalizeType(payload.type) || 'system_alert',
    category: 'system',
    title: cleanString(payload.title, 180) || 'Thong bao he thong',
    body: cleanString(payload.message || payload.body, 1000),
    priority: normalizePriority(payload.priority) || 'normal',
    actionRequired: Boolean(payload.actionRequired),
    orderId: mongoose.Types.ObjectId.isValid(payload.orderId) ? payload.orderId : null,
    targetType: cleanString(payload.targetType, 80),
    targetId: cleanString(payload.targetId, 120),
    translations: payload.translations && typeof payload.translations === 'object' ? payload.translations : {},
    data: payload.data && typeof payload.data === 'object' ? payload.data : {}
  })
  notificationRealtime.emitCreated(toAdminPayload(notification), await getStats())
  return notification
}

async function markRead({ ids = [], all = false } = {}) {
  const now = new Date()

  if (all) {
    const result = await notificationRepository.updateMany(
      { audience: 'admin', deletedAt: null, archivedAt: null, readAt: null },
      { $set: { readAt: now } }
    )
    notificationRealtime.emitRead({ audience: 'admin', all: true, stats: await getStats() })
    return { success: true, modifiedCount: result.modifiedCount || result.nModified || 0 }
  }

  const cleanIds = ids.map(id => cleanString(id)).filter(id => mongoose.Types.ObjectId.isValid(id))
  if (cleanIds.length === 0) throw new AppError('Can cung cap thong bao hop le', 400)

  const result = await notificationRepository.updateMany(
    { _id: { $in: cleanIds }, audience: 'admin', deletedAt: null },
    { $set: { readAt: now } }
  )
  notificationRealtime.emitRead({ audience: 'admin', ids: cleanIds, stats: await getStats() })
  return { success: true, modifiedCount: result.modifiedCount || result.nModified || 0 }
}

async function archiveNotifications(ids = []) {
  const cleanIds = ids.map(id => cleanString(id)).filter(id => mongoose.Types.ObjectId.isValid(id))
  if (cleanIds.length === 0) throw new AppError('Can cung cap thong bao hop le', 400)

  const result = await notificationRepository.updateMany(
    { _id: { $in: cleanIds }, audience: 'admin', deletedAt: null },
    { $set: { archivedAt: new Date() } }
  )
  notificationRealtime.emitDeleted({ audience: 'admin', ids: cleanIds, stats: await getStats() })
  return { success: true, modifiedCount: result.modifiedCount || result.nModified || 0 }
}

async function deleteNotifications(ids = []) {
  const cleanIds = ids.map(id => cleanString(id)).filter(id => mongoose.Types.ObjectId.isValid(id))
  if (cleanIds.length === 0) throw new AppError('Can cung cap thong bao hop le', 400)

  const result = await notificationRepository.updateMany(
    { _id: { $in: cleanIds }, audience: 'admin' },
    { $set: { deletedAt: new Date() } }
  )
  notificationRealtime.emitDeleted({ audience: 'admin', ids: cleanIds, stats: await getStats() })
  return { success: true, modifiedCount: result.modifiedCount || result.nModified || 0 }
}

function createOrderCreatedNotification(order = {}) {
  const orderId = serializeId(order._id || order.id)
  const orderCode = cleanString(order.orderCode) || orderId.slice(-8).toUpperCase()
  const customerName = [order?.contact?.firstName, order?.contact?.lastName].filter(Boolean).join(' ').trim() || 'Khach hang'
  const total = Number(order.total || 0).toLocaleString('vi-VN')

  return createAdminNotification({
    type: 'order_created',
    priority: 'high',
    title: `Don hang moi #${orderCode}`,
    message: `${customerName} vua dat don ${total}d.`,
    targetType: 'order',
    targetId: orderId,
    orderId,
    actionRequired: true,
    translations: {
      en: {
        title: `New order #${orderCode}`,
        message: `${customerName} has placed an order worth ${total} VND.`
      }
    },
    data: { orderCode, customerName, total: order.total || 0 }
  })
}

module.exports = {
  listNotifications,
  createAdminNotification,
  createOrderCreatedNotification,
  markRead,
  archiveNotifications,
  deleteNotifications
}
