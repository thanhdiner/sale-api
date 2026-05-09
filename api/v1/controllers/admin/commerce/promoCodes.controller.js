const logger = require('../../../../../config/logger')
const promoCodesService = require('../../../services/admin/commerce/promoCodes.service')

const handleKnownControllerError = (res, error) => {
  if (!error?.statusCode) {
    return false
  }

  res.status(error.statusCode).json({ error: error.message })
  return true
}

//# GET /api/v1/admin/promo-codes
module.exports.listPromoCodes = async (req, res) => {
  try {
    const result = await promoCodesService.listPromoCodes(req.query)
    res.json(result)
  } catch (err) {
    logger.error('[Admin] Error listing promo codes:', err)
    res.status(500).json({ error: 'Loi lay danh sach ma giam gia' })
  }
}

//# POST /api/v1/admin/promo-codes/create
module.exports.createPromoCode = async (req, res) => {
  try {
    const result = await promoCodesService.createPromoCode(req.body)
    res.json(result)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error('[Admin] Error creating promo code:', err)
    res.status(400).json({ error: err.message })
  }
}

//# GET /api/v1/admin/promo-codes/:id
module.exports.getPromoCode = async (req, res) => {
  try {
    const result = await promoCodesService.getPromoCodeById(req.params.id)
    res.json(result)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error('[Admin] Error getting promo code detail:', err)
    res.status(400).json({ error: 'Loi lay chi tiet' })
  }
}

//# PATCH /api/v1/admin/promo-codes/update/:id
module.exports.updatePromoCode = async (req, res) => {
  try {
    const result = await promoCodesService.updatePromoCode(req.params.id, req.body)
    res.json(result)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error('[Admin] UPDATE PROMO ERROR:', err)
    res.status(400).json({ error: err.message })
  }
}

//# DELETE /api/v1/admin/promo-codes/delete/:id
module.exports.deletePromoCode = async (req, res) => {
  try {
    const result = await promoCodesService.deletePromoCode(req.params.id)
    res.json(result)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error('[Admin] Error deleting promo code:', err)
    res.status(400).json({ error: 'Loi xoa ma' })
  }
}










