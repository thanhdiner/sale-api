const logger = require('../../../../config/logger')
const bannersService = require('../../services/client/banners.service')

//# GET /api/v1/banners
module.exports.index = async (_req, res) => {
  try {
    const result = await bannersService.listActiveBanners()
    res.status(200).json(result)
  } catch (err) {
    logger.error('[Client] Error fetching banners:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}
