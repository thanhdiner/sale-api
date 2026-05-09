const paymentService = require('../../../services/client/commerce/payment.service')
const logger = require('../../../../../config/logger')

module.exports.createVNPayUrl = async (req, res) => {
  try {
    const { orderId } = req.body
    if (!orderId) return res.status(400).json({ error: 'Thiáº¿u orderId' })

    const result = await paymentService.createVNPayUrl({
      orderId,
      userId: req.user.userId,
      req
    })

    res.status(result.statusCode).json(result.body)
  } catch (err) {
    logger.error('[VNPay] createUrl error:', err)
    res.status(500).json({ error: err.message || 'Lá»—i táº¡o VNPay URL' })
  }
}

module.exports.vnpayReturn = async (req, res) => {
  try {
    const result = await paymentService.handleVNPayReturn(req.query)
    res.redirect(result.redirectUrl)
  } catch (err) {
    logger.error('[VNPay] return error:', err)
    res.redirect(`${process.env.CLIENT_URL || 'http://localhost:3000'}/order-success?status=failed&reason=server_error`)
  }
}

module.exports.createMoMoUrl = async (req, res) => {
  try {
    const { orderId } = req.body
    if (!orderId) return res.status(400).json({ error: 'Thiáº¿u orderId' })

    const result = await paymentService.createMoMoUrl({
      orderId,
      userId: req.user.userId
    })

    res.status(result.statusCode).json(result.body)
  } catch (err) {
    logger.error('[MoMo] createUrl error:', err)
    res.status(500).json({ error: err.message || 'Lá»—i táº¡o MoMo URL' })
  }
}

module.exports.momoCallback = async (req, res) => {
  try {
    const result = await paymentService.handleMoMoCallback(req.body)
    if (result.statusCode === 204) {
      return res.status(204).send()
    }
    res.status(result.statusCode).json(result.body)
  } catch (err) {
    logger.error('[MoMo] callback error:', err)
    res.status(500).json({ error: err.message })
  }
}

module.exports.createZaloPayUrl = async (req, res) => {
  try {
    const { orderId } = req.body
    if (!orderId) return res.status(400).json({ error: 'Thiáº¿u orderId' })

    const result = await paymentService.createZaloPayUrl({
      orderId,
      userId: req.user.userId
    })

    res.status(result.statusCode).json(result.body)
  } catch (err) {
    logger.error('[ZaloPay] createUrl error:', err)
    res.status(500).json({ error: err.message || 'Lá»—i táº¡o ZaloPay URL' })
  }
}

module.exports.zalopayCallback = async (req, res) => {
  try {
    const result = await paymentService.handleZaloPayCallback(req.body)
    res.status(result.statusCode).json(result.body)
  } catch (err) {
    logger.error('[ZaloPay] callback error:', err)
    res.status(200).json({ return_code: 0, return_message: err.message })
  }
}










