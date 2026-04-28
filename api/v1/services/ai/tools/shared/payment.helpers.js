/**
 * Payment and bank-info helpers for AI tool executors.
 */

const { bankInfoService, orderRepository, paymentService } = require('./dependencies')

const { PLACE_ORDER_PAYMENT_METHODS } = require('./constants')

const { cleanString } = require('./text.helpers')

const { formatPrice } = require('./format.helpers')

const { getProductObject } = require('./product.helpers')

const { buildOrderPayload, formatOrderCode, getOrderObject, resolveOwnOrderId } = require('./order.helpers')

async function createOnlinePaymentRequest(paymentMethod, orderId, userId, paymentReference = orderId) {
  if (paymentMethod === 'sepay') {
    return {
      method: paymentMethod,
      paymentReference
    }
  }

  const req = {
    headers: {},
    socket: { remoteAddress: '127.0.0.1' }
  }

  let result
  if (paymentMethod === 'vnpay') {
    result = await paymentService.createVNPayUrl({ orderId, userId, req })
  } else if (paymentMethod === 'momo') {
    result = await paymentService.createMoMoUrl({ orderId, userId })
  } else if (paymentMethod === 'zalopay') {
    result = await paymentService.createZaloPayUrl({ orderId, userId })
  } else {
    throw new Error('Phuong thuc thanh toan online khong hop le')
  }

  if (result?.statusCode >= 400 || !result?.body?.paymentUrl) {
    throw new Error(result?.body?.error || 'Khong tao duoc link thanh toan')
  }

  return {
    method: paymentMethod,
    paymentUrl: result.body.paymentUrl
  }
}

function getOrderPaymentReference(order = {}) {
  const source = getOrderObject(order)
  return cleanString(source.orderCode) || source._id?.toString?.() || String(source._id || '')
}

function isPendingPayableOrder(order = {}) {
  const source = getOrderObject(order)
  return source.status === 'pending'
    && source.paymentStatus === 'pending'
    && PLACE_ORDER_PAYMENT_METHODS.includes(source.paymentMethod)
    && source.isDeleted !== true
}

function buildPendingPaymentOrderPreview(order = {}) {
  const source = getOrderObject(order)
  return {
    ...buildOrderPayload(source),
    code: source.orderCode || formatOrderCode(source),
    paymentMethod: source.paymentMethod,
    paymentStatus: source.paymentStatus,
    status: source.status,
    expiresAt: source.reservationExpiresAt || null,
    paymentReference: getOrderPaymentReference(source)
  }
}

async function findPendingPaymentOrders(userId, limit = 5) {
  return orderRepository.findByQuery({
    userId,
    isDeleted: false,
    status: 'pending',
    paymentStatus: 'pending',
    paymentMethod: { $in: PLACE_ORDER_PAYMENT_METHODS }
  }, {
    sort: { createdAt: -1 },
    limit
  })
}

async function resolveOwnedOrderForPayment({ userId, orderId, orderCode } = {}) {
  const hasLookup = !!cleanString(orderId || orderCode)

  if (hasLookup) {
    const resolved = await resolveOwnOrderId(userId, { orderId, orderCode })
    if (resolved.error) return { error: { success: false, ...resolved.error } }

    const order = await orderRepository.findOne({
      _id: resolved.orderId,
      userId,
      isDeleted: false
    })

    if (!order) {
      return {
        error: {
          success: false,
          found: false,
          message: 'Khong tim thay don hang trong tai khoan dang chat.'
        }
      }
    }

    return { order }
  }

  const pendingOrders = await findPendingPaymentOrders(userId, 5)
  if (pendingOrders.length === 0) {
    return {
      error: {
        success: false,
        found: false,
        message: 'Khong tim thay don pending nao can thanh toan trong tai khoan dang chat.'
      }
    }
  }

  if (pendingOrders.length > 1) {
    return {
      error: {
        success: false,
        requiresOrderSelection: true,
        message: 'Tim thay nhieu don pending. Vui long chon dung ma don can lay lai link thanh toan.',
        orders: pendingOrders.map(buildPendingPaymentOrderPreview)
      }
    }
  }

  return { order: pendingOrders[0] }
}

function buildExpiredPaymentResponse(order) {
  return {
    success: false,
    expired: true,
    order: buildPendingPaymentOrderPreview(order),
    message: 'Don hang da het han thanh toan. Vui long tao don moi neu van muon mua.'
  }
}

async function ensureOrderCanResumePayment(order) {
  if (!isPendingPayableOrder(order)) {
    return {
      success: false,
      payable: false,
      order: buildPendingPaymentOrderPreview(order),
      message: 'Don hang nay khong con o trang thai cho thanh toan.'
    }
  }

  if (paymentService.isClosedForPayment(order)) {
    return {
      success: false,
      payable: false,
      order: buildPendingPaymentOrderPreview(order),
      message: 'Don hang da dong hoac khong the thanh toan tiep.'
    }
  }

  if (paymentService.isPaymentWindowExpired(order)) {
    await paymentService.closeExpiredPaymentOrder(order)
    return buildExpiredPaymentResponse(order)
  }

  return null
}

function getNormalizedBankInfoAmount({ amount, order } = {}) {
  const explicitAmount = Number(amount)
  if (Number.isFinite(explicitAmount) && explicitAmount > 0) return explicitAmount

  const orderTotal = Number(order?.total)
  return Number.isFinite(orderTotal) && orderTotal > 0 ? orderTotal : null
}

function buildBankInfoPayload(bankInfo, { order = null, paymentReference = '', amount = null } = {}) {
  const source = getProductObject(bankInfo) || {}
  const reference = cleanString(paymentReference) || (order ? getOrderPaymentReference(order) : '')
  const normalizedAmount = getNormalizedBankInfoAmount({ amount, order })

  return {
    bankName: source.bankName || '',
    accountNumber: source.accountNumber || '',
    accountHolder: source.accountHolder || '',
    noteTemplate: source.noteTemplate || '',
    qrCode: source.qrCode || '',
    amount: normalizedAmount,
    amountFormatted: normalizedAmount != null ? formatPrice(normalizedAmount) : null,
    paymentReference: reference || null,
    transferContent: reference || source.noteTemplate || '',
    requiresExactTransferContent: !!reference,
    order: order ? buildPendingPaymentOrderPreview(order) : null
  }
}

async function getActiveBankInfoPayload({ order = null, paymentReference = '', amount = null } = {}) {
  const result = await bankInfoService.getActiveBankInfo('vi')
  return buildBankInfoPayload(result.bankInfo, { order, paymentReference, amount })
}

module.exports = {
  createOnlinePaymentRequest,
  getOrderPaymentReference,
  isPendingPayableOrder,
  buildPendingPaymentOrderPreview,
  findPendingPaymentOrders,
  resolveOwnedOrderForPayment,
  buildExpiredPaymentResponse,
  ensureOrderCanResumePayment,
  getNormalizedBankInfoAmount,
  buildBankInfoPayload,
  getActiveBankInfoPayload
}
