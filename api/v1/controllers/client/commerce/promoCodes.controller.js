const logger = require('../../../../../config/logger')
const promoCodesService = require('../../../services/client/commerce/promoCodes.service')

module.exports.getPromoCodes = async (_req, res) => {
  try {
    const result = await promoCodesService.getPromoCodes()
    res.json(result)
  } catch (err) {
    logger.error('[Client] getPromoCodes error:', err)
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' })
  }
}

module.exports.validatePromoCode = async (req, res) => {
  try {
    const result = await promoCodesService.validatePromoCode(req.body)
    res.json(result)
  } catch (err) {
    logger.error('[Client] validatePromoCode error:', err)
    res.status(500).json({ valid: false, message: 'Lỗi máy chủ' })
  }
}










