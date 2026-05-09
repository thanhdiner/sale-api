const logger = require('../../../../../config/logger')
const productCategoriesService = require('../../../services/client/product/productCategories.service')
const getRequestLanguage = require('../../../utils/getRequestLanguage')

const handleKnownControllerError = (res, error) => {
  if (!error?.statusCode) {
    return false
  }

  res.status(error.statusCode).json({ message: error.message })
  return true
}

module.exports.index = async (req, res) => {
  try {
    const result = await productCategoriesService.getCategoryTree(getRequestLanguage(req))
    res.json(result)
  } catch (err) {
    logger.error('[Client] Get public categories error:', err)
    res.status(500).json({ error: 'Failed to get product categories', status: 500 })
  }
}

module.exports.getProductsByCategorySlug = async (req, res) => {
  try {
    const result = await productCategoriesService.getProductsByCategorySlug(req.params.slug, getRequestLanguage(req))
    res.json(result)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error('[Client] Get products by category error:', err)
    res.status(500).json({ error: 'Failed to get products by category', status: 500 })
  }
}










