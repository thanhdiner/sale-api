const logger = require('../../../../../config/logger')
const promoCodesService = require('../../../services/client/commerce/promoCodes.service')

module.exports.getPromoCodes = async (_req, res, next) => {
  try {
    const result = await promoCodesService.getPromoCodes()
    res.json(result)
  } catch (err) {
    return next(err)
  }
}

module.exports.validatePromoCode = async (req, res, next) => {
  try {
    const result = await promoCodesService.validatePromoCode(req.body)
    res.json(result)
  } catch (err) {
    return next(err)
  }
}










