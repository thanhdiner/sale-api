const logger = require('../../../../../config/logger')
const ordersService = require('../../../services/client/commerce/orders.service')


module.exports.createOrder = async (req, res, next) => {
  try {
    const result = await ordersService.createOrder(req.user?.userId, req.body)
    res.json(result)
  } catch (err) {
    return next(err)
  }
}

module.exports.createPendingOrder = async (req, res, next) => {
  try {
    const result = await ordersService.createPendingOrder(req.user?.userId, req.body)
    res.json(result)
  } catch (err) {
    return next(err)
  }
}

module.exports.getMyOrders = async (req, res, next) => {
  try {
    const result = await ordersService.getMyOrders(req.user.userId)
    res.json(result)
  } catch (err) {
    return next(err)
  }
}

module.exports.getOrderDetail = async (req, res, next) => {
  try {
    const result = await ordersService.getOrderDetail(req.user.userId, req.params.id)
    res.json(result)
  } catch (err) {
    return next(err)
  }
}

module.exports.cancelOrder = async (req, res, next) => {
  try {
    const result = await ordersService.cancelOrder(req.user?.userId, req.params.id)
    res.json(result)
  } catch (err) {
    return next(err)
  }
}

module.exports.trackOrder = async (req, res, next) => {
  try {
    const result = await ordersService.trackOrder(req.body)
    res.json(result)
  } catch (err) {
    return next(err)
  }
}










