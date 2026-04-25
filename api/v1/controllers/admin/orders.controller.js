const logger = require('../../../../config/logger')
const ordersService = require('../../services/admin/orders.service')

const handleKnownControllerError = (res, error) => {
  if (!error?.statusCode) {
    return false
  }

  res.status(error.statusCode).json({ error: error.message })
  return true
}

//# GET /api/v1/orders
module.exports.getAllOrders = async (req, res) => {
  try {
    const result = await ordersService.listOrders(req.query)
    res.json(result)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error('[Admin] getAllOrders error:', err)
    res.status(500).json({ error: 'Lỗi lấy đơn hàng' })
  }
}

//# GET /api/v1/orders/:id
module.exports.getOrderDetailAdmin = async (req, res) => {
  try {
    const result = await ordersService.getOrderDetail(req.params.id)
    res.json(result)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error('[Admin] getOrderDetailAdmin error:', err)
    res.status(500).json({ error: 'Lỗi lấy đơn hàng' })
  }
}

//# POST /api/v1/orders/:id
module.exports.updateOrderStatus = async (req, res) => {
  try {
    const result = await ordersService.updateOrderStatus(req.params.id, req.body)
    res.json(result)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error('[Admin] updateOrderStatus error:', err)
    res.status(500).json({ error: 'Lỗi cập nhật đơn hàng' })
  }
}

//# DELETE /api/v1/orders/:id
module.exports.deleteOrder = async (req, res) => {
  try {
    const result = await ordersService.deleteOrder(req.params.id)
    res.json(result)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error('[Admin] deleteOrder error:', err)
    res.status(500).json({ error: 'Lỗi xóa đơn hàng' })
  }
}
