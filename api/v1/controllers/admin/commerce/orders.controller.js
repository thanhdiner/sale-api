const logger = require('../../../../../config/logger')
const ordersService = require('../../../services/admin/commerce/orders.service')

//# GET /api/v1/orders
module.exports.getAllOrders = async (req, res, next) => {
  try {
    const result = await ordersService.listOrders({
      ...req.query,
      language: req.get('accept-language')
    })
    res.json(result)
  } catch (err) {
    return next(err)
  }
}

//# GET /api/v1/orders/:id
module.exports.getOrderDetailAdmin = async (req, res, next) => {
  try {
    const result = await ordersService.getOrderDetail(req.params.id, req.get('accept-language'))
    res.json(result)
  } catch (err) {
    return next(err)
  }
}

//# POST /api/v1/orders/:id
module.exports.updateOrderStatus = async (req, res, next) => {
  try {
    const result = await ordersService.updateOrderStatus(req.params.id, req.body, req.get('accept-language'))
    res.json(result)
  } catch (err) {
    return next(err)
  }
}

//# DELETE /api/v1/orders/:id
module.exports.deleteOrder = async (req, res, next) => {
  try {
    const result = await ordersService.deleteOrder(req.params.id)
    res.json(result)
  } catch (err) {
    return next(err)
  }
}










