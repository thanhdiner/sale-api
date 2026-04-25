const cartsService = require('../../services/client/carts.service')
const logger = require('../../../../config/logger')

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

exports.index = async (req, res) => {
  try {
    const result = await cartsService.getCart(req.user?.userId)
    res.json(result)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    res.status(500).json({ error: err.message })
  }
}

exports.add = async (req, res) => {
  try {
    const result = await cartsService.addToCart(req.user?.userId, req.body)
    res.json(result)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    res.status(500).json({ error: err.message })
  }
}

exports.update = async (req, res) => {
  try {
    const result = await cartsService.updateCartItem(req.user?.userId, req.body)
    res.json(result)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    res.status(500).json({ error: err.message })
  }
}

exports.remove = async (req, res) => {
  try {
    const result = await cartsService.removeFromCart(req.user?.userId, req.body.productId)
    res.json(result)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    res.status(500).json({ error: err.message })
  }
}

exports.clear = async (req, res) => {
  try {
    const result = await cartsService.clearCart(req.user?.userId)
    res.json(result)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    res.status(500).json({ error: err.message })
  }
}

exports.removeMany = async (req, res) => {
  try {
    const result = await cartsService.removeManyFromCart(req.user?.userId, req.body.productIds)
    res.json(result)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error('[Cart] removeMany error:', err)
    res.status(500).json({ error: err.message })
  }
}
