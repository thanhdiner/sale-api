const logger = require('../../../../../config/logger')
const productCategoriesService = require('../../../services/client/product/productCategories.service')
const getRequestLanguage = require('../../../utils/getRequestLanguage')


module.exports.index = async (req, res, next) => {
  try {
    const result = await productCategoriesService.getCategoryTree(getRequestLanguage(req))
    res.json(result)
  } catch (err) {
    return next(err)
  }
}

module.exports.getProductsByCategorySlug = async (req, res, next) => {
  try {
    const result = await productCategoriesService.getProductsByCategorySlug(req.params.slug, getRequestLanguage(req))
    res.json(result)
  } catch (err) {
    return next(err)
  }
}










