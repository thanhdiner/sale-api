const logger = require('../../../../../config/logger')
const promoCodesService = require('../../../services/admin/commerce/promoCodes.service')

//# GET /api/v1/admin/promo-codes
module.exports.listPromoCodes = async (req, res, next) => {
  try {
    const result = await promoCodesService.listPromoCodes(req.query)
    res.json(result)
  } catch (err) {
    return next(err)
  }
}

//# POST /api/v1/admin/promo-codes/create
module.exports.createPromoCode = async (req, res, next) => {
  try {
    const result = await promoCodesService.createPromoCode(req.body)
    res.json(result)
  } catch (err) {
    return next(err)
  }
}

//# GET /api/v1/admin/promo-codes/:id
module.exports.getPromoCode = async (req, res, next) => {
  try {
    const result = await promoCodesService.getPromoCodeById(req.params.id)
    res.json(result)
  } catch (err) {
    return next(err)
  }
}

//# PATCH /api/v1/admin/promo-codes/update/:id
module.exports.updatePromoCode = async (req, res, next) => {
  try {
    const result = await promoCodesService.updatePromoCode(req.params.id, req.body)
    res.json(result)
  } catch (err) {
    return next(err)
  }
}

//# DELETE /api/v1/admin/promo-codes/delete/:id
module.exports.deletePromoCode = async (req, res, next) => {
  try {
    const result = await promoCodesService.deletePromoCode(req.params.id)
    res.json(result)
  } catch (err) {
    return next(err)
  }
}










