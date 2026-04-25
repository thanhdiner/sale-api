const logger = require('../../../../config/logger')
const wishlistService = require('../../services/client/wishlist.service')

const handleKnownControllerError = (res, error) => {
  if (!error?.statusCode) {
    return false
  }

  res.status(error.statusCode).json({ error: error.message })
  return true
}

//# GET /api/v1/wishlist?page=1&limit=12
module.exports.index = async (req, res) => {
  try {
    const result = await wishlistService.getWishlist({
      userId: req.user?.userId,
      page: req.query.page,
      limit: req.query.limit
    })

    res.json(result)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error('[Wishlist] index error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

//# POST /api/v1/wishlist/add
module.exports.add = async (req, res) => {
  try {
    const result = await wishlistService.addWishlistItem({
      userId: req.user?.userId,
      productId: req.body?.productId
    })

    res.json(result)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error('[Wishlist] add error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

//# POST /api/v1/wishlist/remove
module.exports.remove = async (req, res) => {
  try {
    const result = await wishlistService.removeWishlistItem({
      userId: req.user?.userId,
      productId: req.body?.productId
    })

    res.json(result)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error('[Wishlist] remove error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

//# POST /api/v1/wishlist/toggle
module.exports.toggle = async (req, res) => {
  try {
    const result = await wishlistService.toggleWishlistItem({
      userId: req.user?.userId,
      productId: req.body?.productId
    })

    res.json(result)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error('[Wishlist] toggle error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

//# POST /api/v1/wishlist/clear
module.exports.clear = async (req, res) => {
  try {
    const result = await wishlistService.clearWishlist({
      userId: req.user?.userId
    })

    res.json(result)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error('[Wishlist] clear error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

//# GET /api/v1/wishlist/check/:productId
module.exports.check = async (req, res) => {
  try {
    const result = await wishlistService.checkWishlistItem({
      userId: req.user?.userId,
      productId: req.params.productId
    })

    res.json(result)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error('[Wishlist] check error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}
