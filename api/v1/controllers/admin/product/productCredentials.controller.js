const productCredentialsService = require('../../../services/admin/product/productCredentials.service')

module.exports.listByProduct = async (req, res, next) => {
  try {
    const result = await productCredentialsService.listByProduct(req.params.productId)
    res.json(result)
  } catch (error) {
    return next(error)
  }
}

module.exports.createMany = async (req, res, next) => {
  try {
    const result = await productCredentialsService.createMany(
      req.params.productId,
      req.body.credentials,
      req.user?.userId
    )
    res.json(result)
  } catch (error) {
    return next(error)
  }
}

module.exports.reveal = async (req, res, next) => {
  try {
    const result = await productCredentialsService.reveal(req.params.credentialId)
    res.json(result)
  } catch (error) {
    return next(error)
  }
}

module.exports.disable = async (req, res, next) => {
  try {
    const result = await productCredentialsService.disable(req.params.credentialId, req.user?.userId)
    res.json(result)
  } catch (error) {
    return next(error)
  }
}










