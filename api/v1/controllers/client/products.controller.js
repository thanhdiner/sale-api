const logger = require('../../../../config/logger')
const productService = require('../../services/client/products.service')

const handleKnownControllerError = (res, error) => {
  if (!error?.statusCode) {
    return false
  }

  res.status(error.statusCode).json({ error: error.message })
  return true
}

module.exports.index = async (req, res) => {
  try {
    const result = await productService.getProductsList(req.query)
    res.json(result)
  } catch (error) {
    if (handleKnownControllerError(res, error)) return
    logger.error('[Products] index error:', error)
    res.status(500).json({ error: 'Internal server error', status: 500 })
  }
}

module.exports.suggest = async (req, res) => {
  try {
    const result = await productService.getSuggestions(req.query)
    res.json(result)
  } catch (error) {
    if (handleKnownControllerError(res, error)) return
    logger.error('[Products] suggest error:', error)
    res.status(500).json({ error: 'Internal server error', status: 500 })
  }
}

module.exports.detail = async (req, res) => {
  try {
    const result = await productService.getProductDetail(req.params.slug)
    res.json(result)
  } catch (error) {
    if (handleKnownControllerError(res, error)) return
    logger.error('[Products] detail error:', error)
    res.status(500).json({ error: 'Internal server error', status: 500 })
  }
}

module.exports.exploreMore = async (req, res) => {
  try {
    const result = await productService.getExploreMore(req.params.id, req.query.limit)
    res.json(result)
  } catch (error) {
    if (handleKnownControllerError(res, error)) return
    logger.error('[Products] exploreMore error:', error)
    res.status(500).json({ error: 'Internal server error', status: 500 })
  }
}

module.exports.recommendations = async (req, res) => {
  try {
    const result = await productService.getRecommendations({
      user: req.user,
      query: req.query
    })
    res.json(result)
  } catch (error) {
    if (handleKnownControllerError(res, error)) return
    logger.error('[Products] recommendations error:', error)
    res.status(500).json({ error: 'Internal server error', status: 500 })
  }
}

module.exports.trackView = async (req, res) => {
  try {
    const result = await productService.trackProductView({
      slug: req.params.slug,
      user: req.user,
      ip: req.ip
    })
    res.json(result)
  } catch (error) {
    if (handleKnownControllerError(res, error)) return
    logger.error('[Products] trackView error:', error)
    res.status(500).json({ error: 'Internal server error', status: 500 })
  }
}
