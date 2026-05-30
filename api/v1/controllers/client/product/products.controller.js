const logger = require('../../../../../config/logger')
const productService = require('../../../services/client/product/products.service')
const backInStockService = require('../../../services/shared/commerce/backInStock.service')
const getRequestLanguage = require('../../../utils/getRequestLanguage')


module.exports.index = async (req, res, next) => {
  try {
    const result = await productService.getProductsList(req.query, getRequestLanguage(req))
    res.json(result)
  } catch (error) {
    return next(error)
  }
}

module.exports.suggest = async (req, res, next) => {
  try {
    const result = await productService.getSuggestions(req.query)
    res.json(result)
  } catch (error) {
    return next(error)
  }
}

module.exports.searchSuggestions = async (req, res, next) => {
  try {
    const result = await productService.getSearchSuggestions(req.query)
    res.json(result)
  } catch (error) {
    return next(error)
  }
}

module.exports.detail = async (req, res, next) => {
  try {
    const result = await productService.getProductDetail(req.params.slug, getRequestLanguage(req))
    res.json(result)
  } catch (error) {
    return next(error)
  }
}

module.exports.exploreMore = async (req, res, next) => {
  try {
    const result = await productService.getExploreMore(req.params.id, req.query.limit)
    res.json(result)
  } catch (error) {
    return next(error)
  }
}

module.exports.recommendations = async (req, res, next) => {
  try {
    const result = await productService.getRecommendations({
      user: req.user,
      query: req.query
    })
    res.json(result)
  } catch (error) {
    return next(error)
  }
}

module.exports.trackView = async (req, res, next) => {
  try {
    const result = await productService.trackProductView({
      slug: req.params.slug,
      user: req.user,
      ip: req.ip
    })
    res.json(result)
  } catch (error) {
    return next(error)
  }
}

module.exports.notifyWhenBackInStock = async (req, res, next) => {
  try {
    const result = await backInStockService.registerBackInStockNotification({
      productId: req.params.id,
      email: req.body?.email,
      user: req.user,
      lang: getRequestLanguage(req)
    })

    res.json(result)
  } catch (error) {
    return next(error)
  }
}

module.exports.unsubscribeWhenBackInStock = async (req, res, next) => {
  try {
    const result = await backInStockService.unregisterBackInStockNotification({
      productId: req.params.id,
      email: req.body?.email,
      user: req.user,
      lang: getRequestLanguage(req)
    })

    res.json(result)
  } catch (error) {
    return next(error)
  }
}










