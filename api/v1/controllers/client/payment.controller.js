const Order = require('../../models/order.model')
const vnpay = require('../../services/payment/vnpay.service')
const momo = require('../../services/payment/momo.service')
const zalopay = require('../../services/payment/zalopay.service')
const { getClientIp } = require('../../helpers/networkHelper')
const logger = require('../../../../config/logger')
const { getIO } = require('../../helpers/socket')
const { sendMail } = require('../../../../config/mailer')
const { paymentSuccessTemplate } = require('../../utils/emailTemplates')

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000'

// ─────────────────────────────────────────
// HELPER — emit socket sau khi thanh toán xác nhận
// ─────────────────────────────────────────
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
      io.to(`user_${order.userId}`).emit('order_status_updated', {
        _id: order._id,
        status: order.status,
        paymentStatus: order.paymentStatus
      })
    }
  } catch (e) {}

  // Send payment success email (fire-and-forget)
  const recipientEmail = order.contact?.email
  if (recipientEmail) {
    const { subject, html } = paymentSuccessTemplate(order)
    sendMail({ to: recipientEmail, subject, html })
  }
}

// ─────────────────────────────────────────
// VNPAY
// ─────────────────────────────────────────

//# POST /api/v1/payment/vnpay/create
module.exports.createVNPayUrl = async (req, res) => {
  try {
    const { orderId } = req.body
    if (!orderId) return res.status(400).json({ error: 'Thiếu orderId' })

    const order = await Order.findOne({ _id: orderId, userId: req.user.userId })
    if (!order) return res.status(404).json({ error: 'Không tìm thấy đơn hàng' })

    const paymentUrl = vnpay.createPaymentUrl({
      orderId: order._id.toString(),
      amount: order.total,
      orderInfo: `SmartMall - Don hang ${order._id}`,
      clientIp: getClientIp(req)
    })

    res.json({ success: true, paymentUrl })
  } catch (err) {
    logger.error('[VNPay] createUrl error:', err)
    res.status(500).json({ error: err.message || 'Lỗi tạo VNPay URL' })
  }
}

//# GET /api/v1/payment/vnpay/return  (redirect từ VNPay sau thanh toán)
module.exports.vnpayReturn = async (req, res) => {
  try {
    const { isValid, isSuccess, orderId, transactionId } = vnpay.verifyReturn(req.query)

    if (!isValid) {
      return res.redirect(`${CLIENT_URL}/order-success?status=failed&reason=invalid_signature`)
    }

    const order = await Order.findById(orderId)
    if (order && order.paymentStatus !== 'paid') {
      order.paymentStatus = isSuccess ? 'paid' : 'failed'
      if (isSuccess) {
        order.paymentTransactionId = transactionId
        order.status = 'confirmed'
      }
      await order.save()
      if (isSuccess) emitOrderConfirmed(order)
    }

    if (isSuccess) {
      return res.redirect(`${CLIENT_URL}/order-success?orderId=${orderId}&method=vnpay`)
    }
    return res.redirect(`${CLIENT_URL}/order-success?status=failed&reason=payment_failed&orderId=${orderId}`)
  } catch (err) {
    logger.error('[VNPay] return error:', err)
    res.redirect(`${CLIENT_URL}/order-success?status=failed&reason=server_error`)
  }
}

// ─────────────────────────────────────────
// MOMO
// ─────────────────────────────────────────

//# POST /api/v1/payment/momo/create
module.exports.createMoMoUrl = async (req, res) => {
  try {
    const { orderId } = req.body
    if (!orderId) return res.status(400).json({ error: 'Thiếu orderId' })

    const order = await Order.findOne({ _id: orderId, userId: req.user.userId })
    if (!order) return res.status(404).json({ error: 'Không tìm thấy đơn hàng' })

    const result = await momo.createPaymentUrl({
      orderId: order._id.toString(),
      amount: order.total,
      orderInfo: `SmartMall - Don hang ${order._id}`
    })

    res.json({ success: true, paymentUrl: result.paymentUrl })
  } catch (err) {
    logger.error('[MoMo] createUrl error:', err)
    res.status(500).json({ error: err.message || 'Lỗi tạo MoMo URL' })
  }
}

//# POST /api/v1/payment/momo/callback  (IPN từ MoMo)
module.exports.momoCallback = async (req, res) => {
  try {
    const { isValid, isSuccess, orderId, transactionId } = momo.verifyCallback(req.body)

    if (!isValid) {
      return res.status(400).json({ message: 'Invalid signature' })
    }

    const order = await Order.findById(orderId)
    if (order && order.paymentStatus !== 'paid') {
      order.paymentStatus = isSuccess ? 'paid' : 'failed'
      if (isSuccess) {
        order.paymentTransactionId = transactionId
        order.status = 'confirmed'
      }
      await order.save()
      if (isSuccess) emitOrderConfirmed(order)
    }

    res.status(204).send()
  } catch (err) {
    logger.error('[MoMo] callback error:', err)
    res.status(500).json({ error: err.message })
  }
}

// ─────────────────────────────────────────
// ZALOPAY
// ─────────────────────────────────────────

//# POST /api/v1/payment/zalopay/create
module.exports.createZaloPayUrl = async (req, res) => {
  try {
    const { orderId } = req.body
    if (!orderId) return res.status(400).json({ error: 'Thiếu orderId' })

    const order = await Order.findOne({ _id: orderId, userId: req.user.userId })
    if (!order) return res.status(404).json({ error: 'Không tìm thấy đơn hàng' })

    const result = await zalopay.createPaymentUrl({
      orderId: order._id.toString(),
      amount: order.total,
      description: `SmartMall - Don hang ${order._id}`
    })

    res.json({ success: true, paymentUrl: result.paymentUrl })
  } catch (err) {
    logger.error('[ZaloPay] createUrl error:', err)
    res.status(500).json({ error: err.message || 'Lỗi tạo ZaloPay URL' })
  }
}

//# POST /api/v1/payment/zalopay/callback
module.exports.zalopayCallback = async (req, res) => {
  try {
    const { isValid, isSuccess, orderId, transactionId } = zalopay.verifyCallback(req.body)

    if (!isValid) {
      return res.json({ return_code: -1, return_message: 'Invalid mac' })
    }

    const order = await Order.findById(orderId)
    if (order && order.paymentStatus !== 'paid') {
      order.paymentStatus = isSuccess ? 'paid' : 'failed'
      if (isSuccess) {
        order.paymentTransactionId = transactionId
        order.status = 'confirmed'
      }
      await order.save()
      if (isSuccess) emitOrderConfirmed(order)
    }

    res.json({ return_code: 1, return_message: 'success' })
  } catch (err) {
    logger.error('[ZaloPay] callback error:', err)
    res.json({ return_code: 0, return_message: err.message })
  }
}
