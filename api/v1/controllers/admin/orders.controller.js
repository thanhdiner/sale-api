const Order = require('../../models/order.model')
const removeAccents = require('remove-accents')
const logger = require('../../../../config/logger')
const { getIO } = require('../../helpers/socket')
const { sendMail } = require('../../../../config/mailer')
const { orderStatusUpdatedTemplate } = require('../../utils/emailTemplates')
const User = require('../../models/user.model')

const ADMIN_ORDER_LIST_FIELDS = [
  '_id',
  'contact.firstName',
  'contact.lastName',
  'contact.firstNameNoAccent',
  'contact.lastNameNoAccent',
  'contact.phone',
  'contact.email',
  'contact.notes',
  'orderItems.name',
  'status',
  'total',
  'createdAt'
].join(' ')

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
  const itemNames = Array.isArray(order?.orderItems) ? order.orderItems.map(item => item?.name).filter(Boolean).join(' ') : ''

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

const resolveOrderEmail = async order => {
  if (order.contact?.email) return order.contact.email
  if (order.userId) {
    const user = await User.findById(order.userId).select('email').lean()
    if (user?.email) {
      logger.debug(`[Mailer] admin: fallback to user.email: ${user.email}`)
      return user.email
    }
  }
  logger.warn(`[Mailer] No email for order ${order._id} - skipping`)
  return null
}

//# GET /api/v1/orders
module.exports.getAllOrders = async (req, res) => {
  try {
    const { page = 1, limit = 20, keyword = '', status = '' } = req.query
    const pageNum = parseInt(page, 10) || 1
    const pageLimit = parseInt(limit, 10) || 20
    const trimmedKeyword = String(keyword || '').trim()
    const baseQuery = { isDeleted: false }

    if (status && status !== '') {
      baseQuery.status = status
    }

    if (!trimmedKeyword) {
      const [total, orders] = await Promise.all([
        Order.countDocuments(baseQuery),
        Order.find(baseQuery)
          .select(ADMIN_ORDER_LIST_FIELDS)
          .sort({ createdAt: -1 })
          .skip((pageNum - 1) * pageLimit)
          .limit(pageLimit)
          .lean()
      ])

      return res.json({ success: true, orders, total })
    }

    const searchMeta = createOrderSearchMeta(trimmedKeyword)
    const orders = await Order.find(baseQuery).select(ADMIN_ORDER_LIST_FIELDS).sort({ createdAt: -1 }).lean()
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
      .map(entry => entry.order)

    res.json({ success: true, orders: paginatedOrders, total })
  } catch (err) {
    logger.error('[Admin] getAllOrders error:', err)
    res.status(500).json({ error: 'Lỗi lấy đơn hàng' })
  }
}

//# GET /api/v1/orders/:id
module.exports.getOrderDetailAdmin = async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, isDeleted: false })
    if (!order) return res.status(404).json({ error: 'Không tìm thấy đơn hàng' })
    res.json({ success: true, order })
  } catch (err) {
    res.status(500).json({ error: 'Lỗi lấy đơn hàng' })
  }
}

//# POST /api/v1/orders/:id
module.exports.updateOrderStatus = async (req, res) => {
  try {
    const { status, transferInfo } = req.body
    const order = await Order.findOne({ _id: req.params.id, isDeleted: false })
    if (!order) return res.status(404).json({ error: 'Không tìm thấy đơn hàng' })

    if (status) order.status = status
    if (transferInfo) order.transferInfo = transferInfo

    await order.save()

    // Notify client realtime vá» tráº¡ng thÃ¡i Ä‘Æ¡n hÃ ng
    try {
      if (order.userId) {
        logger.info(`[Socket] Emitting order_status_updated to user_${order.userId}, status: ${order.status}`)
        getIO().to(`user_${order.userId}`).emit('order_status_updated', {
          _id: order._id,
          status: order.status,
          paymentStatus: order.paymentStatus
        })
      } else {
        logger.warn(`[Socket] Order ${order._id} has no userId â€” cannot notify client`)
      }
    } catch (e) {
      logger.error('[Socket] Emit error:', e.message)
    }

    res.json({ success: true, order })

    // Send status update email (fire-and-forget)
    const notifyStatuses = ['confirmed', 'shipping', 'completed', 'cancelled']
    if (notifyStatuses.includes(order.status)) {
      resolveOrderEmail(order)
        .then(to => {
          if (to) {
            const { subject, html } = orderStatusUpdatedTemplate(order)
            sendMail({ to, subject, html })
          }
        })
        .catch(err => logger.error('[Mailer] admin resolveEmail error:', err))
    }
  } catch (err) {
    res.status(500).json({ error: 'Lỗi cập nhật đơn hàng' })
  }
}

//# DELETE /api/v1/orders/:id
module.exports.deleteOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
    if (!order) return res.status(404).json({ error: 'Không tìm thấy đơn hàng' })
    order.isDeleted = true
    await order.save()
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: 'Lỗi xóa đơn hàng' })
  }
}
