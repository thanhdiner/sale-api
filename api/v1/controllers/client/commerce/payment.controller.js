const paymentService = require('../../../services/client/commerce/payment.service')
const AppError = require('../../../utils/AppError')

module.exports.createVNPayUrl = async (req, res, next) => {
  try {
    const { orderId } = req.body
    if (!orderId) throw new AppError('Missing orderId', 400)

    const result = await paymentService.createVNPayUrl({
      orderId,
      userId: req.user.userId,
      req
    })

    res.status(result.statusCode).json(result.body)
  } catch (err) {
    return next(err)
  }
}

module.exports.vnpayReturn = async (req, res, next) => {
  try {
    const result = await paymentService.handleVNPayReturn(req.query)
    res.redirect(result.redirectUrl)
  } catch (err) {
    return next(err)
  }
}

module.exports.createMoMoUrl = async (req, res, next) => {
  try {
    const { orderId } = req.body
    if (!orderId) throw new AppError('Missing orderId', 400)

    const result = await paymentService.createMoMoUrl({
      orderId,
      userId: req.user.userId
    })

    res.status(result.statusCode).json(result.body)
  } catch (err) {
    return next(err)
  }
}

module.exports.momoCallback = async (req, res, next) => {
  try {
    const result = await paymentService.handleMoMoCallback(req.body)
    if (result.statusCode === 204) {
      return res.status(204).send()
    }
    res.status(result.statusCode).json(result.body)
  } catch (err) {
    return next(err)
  }
}

module.exports.createZaloPayUrl = async (req, res, next) => {
  try {
    const { orderId } = req.body
    if (!orderId) throw new AppError('Missing orderId', 400)

    const result = await paymentService.createZaloPayUrl({
      orderId,
      userId: req.user.userId
    })

    res.status(result.statusCode).json(result.body)
  } catch (err) {
    return next(err)
  }
}

module.exports.zalopayCallback = async (req, res, next) => {
  try {
    const result = await paymentService.handleZaloPayCallback(req.body)
    res.status(result.statusCode).json(result.body)
  } catch (err) {
    return next(err)
  }
}










