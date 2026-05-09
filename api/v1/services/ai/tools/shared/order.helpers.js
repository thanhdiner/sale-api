/**
 * Order lookup and payload helpers for AI tool executors.
 */

const { CLIENT_URL, ordersService } = require('./dependencies')

const { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } = require('./constants')

const { cleanString, isMongoObjectId } = require('./text.helpers')

const { formatPrice } = require('./format.helpers')

function formatOrderCode(order) {
  order = order || {}
  const orderCode = cleanString(order.orderCode)
  if (orderCode) return orderCode.startsWith('#') ? orderCode : `#${orderCode}`

  const id = order?._id?.toString() || ''
  return id ? `#${id.slice(-8).toUpperCase()}` : ''
}

function buildOrderPayload(order = {}) {
  order = order || {}
  const id = order._id?.toString() || null
  const orderCode = cleanString(order.orderCode) || null

  return {
    id,
    orderCode,
    code: formatOrderCode(order),
    status: order.status,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    deliveryMethod: order.deliveryMethod,
    subtotal: order.subtotal,
    subtotalFormatted: formatPrice(order.subtotal),
    discount: order.discount,
    discountFormatted: formatPrice(order.discount),
    shipping: order.shipping,
    shippingFormatted: formatPrice(order.shipping),
    total: order.total,
    totalFormatted: formatPrice(order.total),
    itemCount: Array.isArray(order.orderItems)
      ? order.orderItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0)
      : 0,
    orderUrl: id ? `${CLIENT_URL}/orders/${id}` : null,
    createdAt: order.createdAt || null
  }
}

function getOrderObject(order = {}) {
  return typeof order?.toObject === 'function' ? order.toObject() : (order || {})
}

function normalizeOrderLookupValue({ orderId, orderCode } = {}) {
  return cleanString(orderId || orderCode).replace(/^#/, '')
}

function getOrderComparableCodes(order = {}) {
  const source = getOrderObject(order)
  const id = source._id?.toString?.() || String(source._id || '')
  const orderCode = cleanString(source.orderCode).replace(/^#/, '')
  const displayCode = formatOrderCode(source).replace(/^#/, '')

  return [id, orderCode, displayCode]
    .filter(Boolean)
    .map(value => value.toLowerCase())
}

function orderMatchesLookup(order, lookup) {
  const normalizedLookup = cleanString(lookup).replace(/^#/, '').toLowerCase()
  if (!normalizedLookup) return false

  const codes = getOrderComparableCodes(order)
  if (codes.includes(normalizedLookup)) return true

  return normalizedLookup.length >= 4 && codes.some(code => code.endsWith(normalizedLookup))
}

async function resolveOwnOrderId(userId, lookup = {}) {
  const value = normalizeOrderLookupValue(lookup)
  if (!value) {
    return {
      error: {
        found: false,
        message: 'Vui long cung cap ma don hang can thao tac.'
      }
    }
  }

  if (isMongoObjectId(value)) {
    return { orderId: value }
  }

  const result = await ordersService.getMyOrders(userId)
  const orders = Array.isArray(result?.orders) ? result.orders : []
  const matches = orders.filter(order => orderMatchesLookup(order, value))

  if (matches.length === 0) {
    return {
      error: {
        found: false,
        message: `Khong tim thay don hang "${value}" trong tai khoan dang chat.`
      }
    }
  }

  if (matches.length > 1) {
    return {
      error: {
        found: false,
        ambiguous: true,
        message: 'Tim thay nhieu don co ma gan giong nhau. Vui long cung cap ma don day du hon.',
        orders: matches.slice(0, 5).map(order => buildOrderPayload(order))
      }
    }
  }

  return { orderId: matches[0]._id.toString() }
}

function buildOrderItemPayload(item = {}) {
  const quantity = Number(item.quantity || 0)
  const unitPrice = Number(item.price ?? item.salePrice ?? 0)

  return {
    productId: item.productId?.toString?.() || String(item.productId || ''),
    name: item.name || 'San pham',
    quantity,
    unitPrice,
    unitPriceFormatted: formatPrice(unitPrice),
    lineTotal: unitPrice * quantity,
    lineTotalFormatted: formatPrice(unitPrice * quantity),
    deliveryType: item.deliveryType || 'manual'
  }
}

function buildOrderSummaryPayload(order = {}) {
  const source = getOrderObject(order)
  const items = Array.isArray(source.orderItems) ? source.orderItems : []

  return {
    ...buildOrderPayload(source),
    statusLabel: ORDER_STATUS_LABELS[source.status] || source.status,
    paymentStatusLabel: PAYMENT_STATUS_LABELS[source.paymentStatus] || source.paymentStatus,
    canCancel: source.status === 'pending',
    itemsPreview: items.slice(0, 3).map(buildOrderItemPayload)
  }
}

module.exports = {
  formatOrderCode,
  buildOrderPayload,
  getOrderObject,
  normalizeOrderLookupValue,
  getOrderComparableCodes,
  orderMatchesLookup,
  resolveOwnOrderId,
  buildOrderItemPayload,
  buildOrderSummaryPayload
}










