const cartsService = require('../../../services/client/commerce/carts.service')
const logger = require('../../../../../config/logger')
const getRequestLanguage = require('../../../utils/getRequestLanguage')


exports.index = async (req, res, next) => {
  try {
    const result = await cartsService.getCart(req.user?.userId, getRequestLanguage(req))
    res.json(result)
  } catch (err) {
    return next(err)
  }
}

exports.add = async (req, res, next) => {
  try {
    const result = await cartsService.addToCart(req.user?.userId, req.body)
    res.json(result)
  } catch (err) {
    return next(err)
  }
}

exports.update = async (req, res, next) => {
  try {
    const result = await cartsService.updateCartItem(req.user?.userId, req.body)
    res.json(result)
  } catch (err) {
    return next(err)
  }
}

exports.remove = async (req, res, next) => {
  try {
    const result = await cartsService.removeFromCart(req.user?.userId, req.body.productId)
    res.json(result)
  } catch (err) {
    return next(err)
  }
}

exports.clear = async (req, res, next) => {
  try {
    const result = await cartsService.clearCart(req.user?.userId)
    res.json(result)
  } catch (err) {
    return next(err)
  }
}

exports.removeMany = async (req, res, next) => {
  try {
    const result = await cartsService.removeManyFromCart(req.user?.userId, req.body.productIds)
    res.json(result)
  } catch (err) {
    return next(err)
  }
}










