const mongoose = require('mongoose')
const removeAccents = require('remove-accents')
const AppError = require('../../../utils/AppError')
const orderRepository = require('../../../repositories/commerce/order.repository')
const userRepository = require('../../../repositories/access/user.repository')
const clientOrdersService = require('../../client/commerce/orders.service')
const notificationsService = require('../../client/commerce/notifications.service')
const digitalDeliveryService = require('../../shared/commerce/digitalDelivery.service')
const logger = require('../../../../../config/logger')
const { getIO } = require('../../../helpers/socket')
const { sendMail } = require('../../../../../config/mailer')
const { orderStatusUpdatedTemplate } = require('../../../utils/emailTemplates')

const ADMIN_ORDER_LIST_FIELDS = [
  '_id',
  'contact.firstName',
  'contact.lastName',
  'contact.firstNameNoAccent',
  'contact.lastNameNoAccent',
  'contact.phone',
  'contact.email',
  'contact.notes',
  'orderItems.productId',
  'orderItems.name',
  'orderItems.image',
  'orderItems.quantity',
  'orderItems.deliveryType',
  'status',
  'paymentStatus',
  'paymentMethod',
  'deliveryMethod',
  'total',
  'createdAt'
].join(' ')

const ADMIN_ORDER_ITEM_PRODUCT_POPULATE = {
  path: 'orderItems.productId',
  select: 'title translations thumbnail slug deliveryInstructions'
}

const normalizeLanguage = language => (String(language || '').toLowerCase().startsWith('en') ? 'en' : 'vi')

const hasText = value => typeof value === 'string' && value.trim().length > 0

const toPlainObject = item => {
  if (!item) return item
  return item.toObject ? item.toObject() : { ...item }
}

const getLocalizedOrderItemName = (item, language) => {
  const product = item?.productId && typeof item.productId === 'object' ? item.productId : null
  const translatedTitle = language === 'en' ? product?.translations?.en?.title : null

  if (hasText(translatedTitle)) return translatedTitle
  if (hasText(product?.title)) return product.title
  if (hasText(item?.name)) return item.name

  return item?.name || ''
}

const getLocalizedOrderItemDeliveryInstructions = (item, language) => {
  const product = item?.productId && typeof item.productId === 'object' ? item.productId : null
  const translatedInstructions = language === 'en' ? product?.translations?.en?.deliveryInstructions : null

  if (hasText(translatedInstructions)) return translatedInstructions
  if (hasText(product?.deliveryInstructions)) return product.deliveryInstructions
  if (hasText(item?.deliveryInstructions)) return item.deliveryInstructions

  return item?.deliveryInstructions || ''
}

const localizeOrder = (order, languageInput) => {
  const language = normalizeLanguage(languageInput)
  const plainOrder = toPlainObject(order)

  if (!plainOrder) return plainOrder

  return {
    ...plainOrder,
    orderItems: Array.isArray(plainOrder.orderItems)
      ? plainOrder.orderItems.map(item => ({
          ...item,
          localizedName: getLocalizedOrderItemName(item, language),
          localizedDeliveryInstructions: getLocalizedOrderItemDeliveryInstructions(item, language)
        }))
      : []
  }
}

const normalizeSearchValue = value =>
  removeAccents(String(value || ''))
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()

const compactSearchValue = value => normalizeSearchValue(value).replace(/[^a-z0-9]/g, '')

const escapeRegex = value => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const createLooseRegex = value => {
  const compactValue = compactSearchValue(value)

  if (!compactValue) {
    return null
  }

  return new RegExp(compactValue.split('').map(char => escapeRegex(char)).join('.*'), 'i')
}

const isSubsequenceMatch = (needle, haystack) => {
  if (!needle || !haystack) {
    return false
  }

  let haystackIndex = 0

  for (const char of needle) {
    haystackIndex = haystack.indexOf(char, haystackIndex)

    if (haystackIndex === -1) {
      return false
    }

    haystackIndex += 1
  }

  return true
}

const getLevenshteinDistance = (source, target) => {
  const rows = source.length + 1
  const cols = target.length + 1
  const matrix = Array.from({ length: rows }, () => Array(cols).fill(0))

  for (let row = 0; row < rows; row += 1) {
    matrix[row][0] = row
  }

  for (let col = 0; col < cols; col += 1) {
    matrix[0][col] = col
  }

  for (let row = 1; row < rows; row += 1) {
    for (let col = 1; col < cols; col += 1) {
      const substitutionCost = source[row - 1] === target[col - 1] ? 0 : 1

      matrix[row][col] = Math.min(
        matrix[row - 1][col] + 1,
        matrix[row][col - 1] + 1,
        matrix[row - 1][col - 1] + substitutionCost
      )
    }
  }

  return matrix[source.length][target.length]
}

const getSimilarityScore = (source, target) => {
  if (!source || !target) {
    return 0
  }

  const longestLength = Math.max(source.length, target.length)

  if (!longestLength) {
    return 0
  }

  return 1 - getLevenshteinDistance(source, target) / longestLength
}

const getBestTokenSimilarity = (needle, haystack) => {
  const tokens = normalizeSearchValue(haystack).split(/[^a-z0-9]+/).filter(Boolean)
  let bestScore = 0

  for (const token of tokens) {
    const normalizedToken = compactSearchValue(token)

    if (!normalizedToken) {
      continue
    }

    const lengthDelta = Math.abs(normalizedToken.length - needle.length)
    if (lengthDelta > Math.max(2, Math.floor(needle.length * 0.4))) {
      continue
    }

    bestScore = Math.max(bestScore, getSimilarityScore(needle, normalizedToken))
  }

  return bestScore
}

const getOrderCodeFragments = orderId => {
  const id = String(orderId || '')
  const shortCode = id.slice(-6).toUpperCase()

  return [id, shortCode, `#${shortCode}`]
}

const getOrderSearchValues = order => {
  const firstName = order?.contact?.firstName || ''
  const lastName = order?.contact?.lastName || ''
  const fullName = [firstName, lastName].filter(Boolean).join(' ')
  const reverseFullName = [lastName, firstName].filter(Boolean).join(' ')
  const itemNames = Array.isArray(order?.orderItems)
    ? order.orderItems
        .flatMap(item => [
          item?.name,
          item?.productId && typeof item.productId === 'object' ? item.productId.title : '',
          item?.productId && typeof item.productId === 'object' ? item.productId.translations?.en?.title : ''
        ])
        .filter(Boolean)
        .join(' ')
    : ''

  return [
    ...getOrderCodeFragments(order?._id),
    fullName,
    reverseFullName,
    firstName,
    lastName,
    order?.contact?.firstNameNoAccent,
    order?.contact?.lastNameNoAccent,
    order?.contact?.phone,
    order?.contact?.email,
    order?.contact?.notes,
    itemNames
  ].filter(Boolean)
}

const createOrderSearchMeta = keyword => {
  const normalizedKeyword = normalizeSearchValue(keyword)

  return {
    normalizedKeyword,
    compactKeyword: compactSearchValue(keyword),
    keywordTerms: normalizedKeyword.split(/\s+/).filter(Boolean),
    looseRegex: createLooseRegex(keyword)
  }
}

const getSearchScoreForValue = (value, searchMeta) => {
  const { normalizedKeyword, compactKeyword, keywordTerms, looseRegex } = searchMeta
  const normalizedValue = normalizeSearchValue(value)
  const compactValue = compactSearchValue(value)

  if (!normalizedValue || !compactValue || !compactKeyword) {
    return 0
  }

  if (compactValue === compactKeyword) {
    return 130
  }

  if (normalizedValue === normalizedKeyword) {
    return 126
  }

  if (normalizedValue.includes(normalizedKeyword) || compactValue.includes(compactKeyword)) {
    return 118
  }

  if (keywordTerms.length > 1 && keywordTerms.every(term => normalizedValue.includes(term))) {
    return 106
  }

  if (looseRegex && looseRegex.test(compactValue)) {
    return 94
  }

  if (isSubsequenceMatch(compactKeyword, compactValue)) {
    return 88
  }

  if (compactKeyword.length >= 4) {
    const tokenSimilarity = getBestTokenSimilarity(compactKeyword, normalizedValue)
    if (tokenSimilarity >= 0.82) {
      return Math.round(tokenSimilarity * 100)
    }
  }

  return 0
}

const getOrderSearchScore = (order, searchMeta) => {
  if (!searchMeta?.compactKeyword) {
    return 0
  }

  const values = getOrderSearchValues(order)
  const combinedValue = values.join(' ')

  return [...values, combinedValue].reduce((bestScore, value) => {
    return Math.max(bestScore, getSearchScoreForValue(value, searchMeta))
  }, 0)
}

function ensureValidObjectId(id, message = 'ID đơn hàng không hợp lệ') {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(message, 400)
  }
}

async function getOrderByIdOrThrow(id, message = 'Không tìm thấy đơn hàng', options = {}) {
  ensureValidObjectId(id)

  const order = await orderRepository.findByIdNotDeleted(id, options)

  if (!order) {
    throw new AppError(message, 404)
  }

  return order
}

async function resolveOrderEmail(order) {
  if (order.contact?.email) return order.contact.email
  if (order.userId) {
    const user = await userRepository.findEmailById(order.userId)
    if (user?.email) {
      logger.debug(`[Mailer] admin: fallback to user.email: ${user.email}`)
      return user.email
    }
  }
  logger.warn(`[Mailer] No email for order ${order._id} - skipping`)
  return null
}

function emitOrderStatusUpdate(order) {
  try {
    if (order.userId) {
      logger.info(`[Socket] Emitting order_status_updated to user_${order.userId}, status: ${order.status}`)
      notificationsService.createOrderStatusNotification(order)
      getIO().to(`user_${order.userId}`).emit('order_status_updated', {
        _id: order._id,
        status: order.status,
        paymentStatus: order.paymentStatus
      })
    } else {
      logger.warn(`[Socket] Order ${order._id} has no userId - cannot notify client`)
    }
  } catch (error) {
    logger.error('[Socket] Emit error:', error.message)
  }
}

function queueOrderStatusEmail(order) {
  const notifyStatuses = ['confirmed', 'shipping', 'completed', 'cancelled']
  if (!notifyStatuses.includes(order.status)) {
    return
  }

  resolveOrderEmail(order)
    .then(to => {
      if (to) {
        const { subject, html } = orderStatusUpdatedTemplate(order)
        sendMail({ to, subject, html })
      }
    })
    .catch(error => logger.error('[Mailer] admin resolveEmail error:', error))
}

async function listOrders(params = {}) {
  const { page = 1, limit = 20, keyword = '', search = '', status = '', language } = params
  const pageNum = parseInt(page, 10) || 1
  const pageLimit = parseInt(limit, 10) || 20
  const trimmedKeyword = String(keyword || search || '').trim()
  const baseQuery = { isDeleted: false }

  if (status && status !== '') {
    baseQuery.status = status
  }

  if (!trimmedKeyword) {
    const [total, orders] = await Promise.all([
      orderRepository.countByQuery(baseQuery),
      orderRepository.findByQuery(baseQuery, {
        select: ADMIN_ORDER_LIST_FIELDS,
        sort: { createdAt: -1 },
        skip: (pageNum - 1) * pageLimit,
        limit: pageLimit,
        populate: ADMIN_ORDER_ITEM_PRODUCT_POPULATE,
        lean: true
      })
    ])

    return { success: true, orders: orders.map(order => localizeOrder(order, language)), total }
  }

  const searchMeta = createOrderSearchMeta(trimmedKeyword)
  const orders = await orderRepository.findByQuery(baseQuery, {
    select: ADMIN_ORDER_LIST_FIELDS,
    sort: { createdAt: -1 },
    populate: ADMIN_ORDER_ITEM_PRODUCT_POPULATE,
    lean: true
  })

  const matchedOrders = orders
    .map(order => ({
      order,
      score: getOrderSearchScore(order, searchMeta)
    }))
    .filter(entry => entry.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score
      }

      return new Date(right.order.createdAt).getTime() - new Date(left.order.createdAt).getTime()
    })

  const total = matchedOrders.length
  const paginatedOrders = matchedOrders
    .slice((pageNum - 1) * pageLimit, pageNum * pageLimit)
    .map(entry => localizeOrder(entry.order, language))

  return { success: true, orders: paginatedOrders, total }
}

async function getOrderDetail(id, language) {
  const order = await getOrderByIdOrThrow(id, undefined, {
    populate: ADMIN_ORDER_ITEM_PRODUCT_POPULATE
  })
  return { success: true, order: localizeOrder(order, language) }
}

async function updateOrderStatus(id, payload = {}, language) {
  const { status, paymentStatus, transferInfo } = payload
  const order = await getOrderByIdOrThrow(id)

  if (status === 'cancelled' && order.status !== 'cancelled') {
    await clientOrdersService.restoreOrderStock(order)
  }
  if (status) order.status = status
  if (paymentStatus) order.paymentStatus = paymentStatus
  if (transferInfo) order.transferInfo = transferInfo

  if (order.paymentStatus === 'paid' && order.status !== 'cancelled') {
    await digitalDeliveryService.finalizeOrderDelivery(order)
  }

  await order.save()

  emitOrderStatusUpdate(order)
  queueOrderStatusEmail(order)

  const populatedOrder = await getOrderByIdOrThrow(id, undefined, {
    populate: ADMIN_ORDER_ITEM_PRODUCT_POPULATE
  })

  return { success: true, order: localizeOrder(populatedOrder, language) }
}

async function deleteOrder(id) {
  ensureValidObjectId(id)

  const order = await orderRepository.findById(id)
  if (!order) {
    throw new AppError('Không tìm thấy đơn hàng', 404)
  }

  order.isDeleted = true
  await order.save()

  return { success: true }
}

module.exports = {
  listOrders,
  getOrderDetail,
  updateOrderStatus,
  deleteOrder
}












