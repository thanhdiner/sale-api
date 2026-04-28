const vnpay = require('../../services/payment/vnpay.service')
const momo = require('../../services/payment/momo.service')
const zalopay = require('../../services/payment/zalopay.service')
const { getClientIp } = require('../../helpers/networkHelper')
const logger = require('../../../../config/logger')
const { getIO } = require('../../helpers/socket')
const { sendMail } = require('../../../../config/mailer')
const { paymentSuccessTemplate } = require('../../utils/emailTemplates')
const orderRepository = require('../../repositories/order.repository')
const userRepository = require('../../repositories/user.repository')
const ordersService = require('./orders.service')
const notificationsService = require('./notifications.service')
const digitalDeliveryService = require('../digitalDelivery.service')

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000'

async function resolveOrderEmail(order) {
  if (order.contact?.email) return order.contact.email
  if (order.userId) {
    const user = await userRepository.findEmailById(order.userId)
    if (user?.email) {
      logger.debug(`[Mailer] payment: fallback to user.email: ${user.email}`)
      return user.email
    }
  }
  logger.warn(`[Mailer] No email for order ${order._id} — skipping`)
  return null
}

function emitOrderConfirmed(order) {
  try {
    const io = getIO()
    io.to('admin').emit('new_order', {
      _id: order._id,
      contact: order.contact,
      total: order.total,
      paymentMethod: order.paymentMethod,
      createdAt: order.createdAt
    })
    if (order.userId) {
      notificationsService.createOrderStatusNotification(order)
      io.to(`user_${order.userId}`).emit('order_status_updated', {
        _id: order._id,
        status: order.status,
        paymentStatus: order.paymentStatus
      })
    }
  } catch {}

  resolveOrderEmail(order)
    .then(to => {
      if (to) {
        const { subject, html } = paymentSuccessTemplate(order)
        sendMail({ to, subject, html })
      }
    })
    .catch(err => logger.error('[Mailer] payment resolveEmail error:', err))
}

async function getOwnedOrder(orderId, userId) {
  return orderRepository.findOne({ _id: orderId, userId })
}

function isPaymentWindowExpired(order, now = new Date()) {
  return !!(
    order?.paymentStatus === 'pending' &&
    order.reservationExpiresAt &&
    new Date(order.reservationExpiresAt).getTime() <= now.getTime()
  )
}

function isClosedForPayment(order) {
  return order?.status === 'cancelled' || order?.paymentStatus === 'failed'
}

async function closeExpiredPaymentOrder(order) {
  if (!order || order.paymentStatus !== 'pending' || order.status !== 'pending') {
    return false
  }

  await ordersService.restoreOrderStock(order)
  order.paymentStatus = 'failed'
  order.status = 'cancelled'
  order.paymentExpiredAt = new Date()
  order.cancelledAt = order.paymentExpiredAt
  await order.save()
  return true
}

async function getPaymentStartError(order, method) {
  if (order.paymentMethod !== method) {
    return { statusCode: 400, body: { error: 'Phuong thuc thanh toan khong khop voi don hang' } }
  }

  if (order.paymentStatus === 'paid') {
    return { statusCode: 400, body: { error: 'Don hang da duoc thanh toan' } }
  }

  if (isClosedForPayment(order)) {
    return { statusCode: 410, body: { error: 'Don hang da dong hoac het han thanh toan' } }
  }

  if (isPaymentWindowExpired(order)) {
    await closeExpiredPaymentOrder(order)
    return { statusCode: 410, body: { error: 'Don hang da het han thanh toan' } }
  }

  return null
}

function isPaymentAmountMatched(order, paidAmount) {
  if (paidAmount === undefined || paidAmount === null || paidAmount === '') {
    return true
  }

  const normalizedPaidAmount = Math.round(Number(paidAmount))
  const normalizedOrderTotal = Math.round(Number(order?.total))

  return Number.isFinite(normalizedPaidAmount)
    && Number.isFinite(normalizedOrderTotal)
    && normalizedPaidAmount === normalizedOrderTotal
}

function isPaymentMethodMatched(order, method) {
  return !!order && order.paymentMethod === method
}

async function finalizeSuccessfulPayment(order, transactionId, paidAmount = null) {
  if (!order || order.paymentStatus === 'paid') {
    return false
  }

  if (isClosedForPayment(order) || isPaymentWindowExpired(order)) {
    await closeExpiredPaymentOrder(order)
    return false
  }

  if (!isPaymentAmountMatched(order, paidAmount)) {
    logger.warn(`[Payment] Amount mismatch for order ${order._id}: paid=${paidAmount}, expected=${order.total}`)
    await failPayment(order)
    return false
  }

  order.paymentStatus = 'paid'
  order.paymentTransactionId = transactionId
  order.status = 'confirmed'
  await digitalDeliveryService.finalizeOrderDelivery(order)
  await ordersService.markOrderPromoUsed(order)
  await order.save()
  emitOrderConfirmed(order)
  return true
}

async function failPayment(order) {
  if (!order || order.paymentStatus === 'paid') {
    return
  }

  if (!isClosedForPayment(order)) {
    order.paymentStatus = 'failed'
    await ordersService.restoreOrderStock(order)
    await order.save()
  }
}

async function createVNPayUrl({ orderId, userId, req }) {
  const order = await getOwnedOrder(orderId, userId)
  if (!order) {
    return { statusCode: 404, body: { error: 'Không tìm thấy đơn hàng' } }
  }

  const paymentStartError = await getPaymentStartError(order, 'vnpay')
  if (paymentStartError) return paymentStartError

  const paymentUrl = vnpay.createPaymentUrl({
    orderId: order._id.toString(),
    amount: order.total,
    orderInfo: `SmartMall - Don hang ${order._id}`,
    clientIp: getClientIp(req)
  })

  return { statusCode: 200, body: { success: true, paymentUrl } }
}

async function handleVNPayReturn(query) {
  const { isValid, isSuccess, orderId, transactionId, amount } = vnpay.verifyReturn(query)

  if (!isValid) {
    return { redirectUrl: `${CLIENT_URL}/order-success?status=failed&reason=invalid_signature` }
  }

  const order = await orderRepository.findById(orderId)
  if (order && isPaymentWindowExpired(order)) {
    await closeExpiredPaymentOrder(order)
    return { redirectUrl: `${CLIENT_URL}/order-success?status=failed&reason=order_expired&orderId=${orderId}` }
  }

  if (isSuccess) {
    if (order && isClosedForPayment(order)) {
      return { redirectUrl: `${CLIENT_URL}/order-success?status=failed&reason=order_expired&orderId=${orderId}` }
    }

    if (!isPaymentMethodMatched(order, 'vnpay')) {
      logger.warn(`[Payment] VNPay callback ignored for order ${orderId}: current method=${order?.paymentMethod}`)
      return { redirectUrl: `${CLIENT_URL}/order-success?status=failed&reason=payment_method_changed&orderId=${orderId}` }
    }

    const finalized = await finalizeSuccessfulPayment(order, transactionId, amount)
    return {
      redirectUrl: finalized
        ? `${CLIENT_URL}/order-success?orderId=${orderId}&method=vnpay`
        : `${CLIENT_URL}/order-success?status=failed&reason=amount_mismatch&orderId=${orderId}`
    }
  }

  await failPayment(order)
  return { redirectUrl: `${CLIENT_URL}/order-success?status=failed&reason=payment_failed&orderId=${orderId}` }
}

async function createMoMoUrl({ orderId, userId }) {
  const order = await getOwnedOrder(orderId, userId)
  if (!order) {
    return { statusCode: 404, body: { error: 'Không tìm thấy đơn hàng' } }
  }

  const paymentStartError = await getPaymentStartError(order, 'momo')
  if (paymentStartError) return paymentStartError

  const result = await momo.createPaymentUrl({
    orderId: order._id.toString(),
    amount: order.total,
    orderInfo: `SmartMall - Don hang ${order._id}`
  })

  return { statusCode: 200, body: { success: true, paymentUrl: result.paymentUrl } }
}

async function handleMoMoCallback(payload) {
  const { isValid, isSuccess, orderId, transactionId, amount } = momo.verifyCallback(payload)

  if (!isValid) {
    return { statusCode: 400, body: { message: 'Invalid signature' } }
  }

  const order = await orderRepository.findById(orderId)
  if (order && isPaymentWindowExpired(order)) {
    await closeExpiredPaymentOrder(order)
    return { statusCode: 204, body: null }
  }

  if (isSuccess) {
    if (!isPaymentMethodMatched(order, 'momo')) {
      logger.warn(`[Payment] MoMo callback ignored for order ${orderId}: current method=${order?.paymentMethod}`)
      return { statusCode: 204, body: null }
    }

    if (!isClosedForPayment(order)) {
      await finalizeSuccessfulPayment(order, transactionId, amount)
    }
  } else {
    if (isPaymentMethodMatched(order, 'momo')) {
      await failPayment(order)
    }
  }

  return { statusCode: 204, body: null }
}

async function createZaloPayUrl({ orderId, userId }) {
  const order = await getOwnedOrder(orderId, userId)
  if (!order) {
    return { statusCode: 404, body: { error: 'Không tìm thấy đơn hàng' } }
  }

  const paymentStartError = await getPaymentStartError(order, 'zalopay')
  if (paymentStartError) return paymentStartError

  const result = await zalopay.createPaymentUrl({
    orderId: order._id.toString(),
    amount: order.total,
    description: `SmartMall - Don hang ${order._id}`
  })

  return { statusCode: 200, body: { success: true, paymentUrl: result.paymentUrl } }
}

async function handleZaloPayCallback(payload) {
  const { isValid, isSuccess, orderId, transactionId, amount } = zalopay.verifyCallback(payload)

  if (!isValid) {
    return { statusCode: 200, body: { return_code: -1, return_message: 'Invalid mac' } }
  }

  const order = await orderRepository.findById(orderId)
  if (order && isPaymentWindowExpired(order)) {
    await closeExpiredPaymentOrder(order)
    return { statusCode: 200, body: { return_code: 1, return_message: 'success' } }
  }

  if (isSuccess) {
    if (!isPaymentMethodMatched(order, 'zalopay')) {
      logger.warn(`[Payment] ZaloPay callback ignored for order ${orderId}: current method=${order?.paymentMethod}`)
      return { statusCode: 200, body: { return_code: 1, return_message: 'success' } }
    }

    if (!isClosedForPayment(order)) {
      await finalizeSuccessfulPayment(order, transactionId, amount)
    }
  } else {
    if (isPaymentMethodMatched(order, 'zalopay')) {
      await failPayment(order)
    }
  }

  return { statusCode: 200, body: { return_code: 1, return_message: 'success' } }
}

module.exports = {
  createVNPayUrl,
  handleVNPayReturn,
  createMoMoUrl,
  handleMoMoCallback,
  createZaloPayUrl,
  handleZaloPayCallback,
  finalizeSuccessfulPayment,
  isPaymentWindowExpired,
  isClosedForPayment,
  closeExpiredPaymentOrder
}
