const logger = require('../../../../../config/logger')
const ordersService = require('../../../services/client/commerce/orders.service')

const handleKnownControllerError = (res, error) => {
  if (!error?.statusCode) {
    return false
  }

  const payload = { error: error.message }
  if (error.details) {
    Object.assign(payload, error.details)
  }

  res.status(error.statusCode).json(payload)
  return true
}

module.exports.createOrder = async (req, res) => {
  try {
    const result = await ordersService.createOrder(req.user?.userId, req.body)
    res.json(result)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error('[Client] createOrder error:', err)
    res.status(500).json({ error: 'Lỗi tạo đơn hàng' })
  }
}

module.exports.createPendingOrder = async (req, res) => {
  try {
    const result = await ordersService.createPendingOrder(req.user?.userId, req.body)
    res.json(result)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error('[Client] createPendingOrder error:', err)
    res.status(500).json({ error: 'Lỗi tạo đơn hàng' })
  }
}

module.exports.getMyOrders = async (req, res) => {
  try {
    const result = await ordersService.getMyOrders(req.user.userId)
    res.json(result)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    res.status(500).json({ error: 'Lỗi lấy đơn hàng' })
  }
}

module.exports.getOrderDetail = async (req, res) => {
  try {
    const result = await ordersService.getOrderDetail(req.user.userId, req.params.id)
    res.json(result)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    res.status(500).json({ error: 'Lỗi lấy đơn hàng' })
  }
}

module.exports.cancelOrder = async (req, res) => {
  try {
    const result = await ordersService.cancelOrder(req.user?.userId, req.params.id)
    res.json(result)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    res.status(500).json({ error: err.message })
  }
}

module.exports.trackOrder = async (req, res) => {
  try {
    const result = await ordersService.trackOrder(req.body)
    res.json(result)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error('[Client] trackOrder error:', err)
    res.status(500).json({ error: 'Lỗi tra cứu đơn hàng' })
  }
}










