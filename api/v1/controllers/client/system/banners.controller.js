const logger = require('../../../../../config/logger')
const bannersService = require('../../../services/client/system/banners.service')
const getRequestLanguage = require('../../../utils/getRequestLanguage')

//# GET /api/v1/banners
module.exports.index = async (req, res) => {
  try {
    const result = await bannersService.listActiveBanners(getRequestLanguage(req))
    res.status(200).json(result)
  } catch (err) {
    logger.error('[Client] Error fetching banners:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}










