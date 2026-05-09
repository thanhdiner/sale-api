const logger = require('../../../../../config/logger')
const vipContentService = require('../../../services/client/cms/vipContent.service')
const getRequestLanguage = require('../../../utils/getRequestLanguage')

module.exports.index = async (req, res) => {
  try {
    const result = await vipContentService.getVipContent(getRequestLanguage(req))
    res.status(200).json(result)
  } catch (err) {
    logger.error('[Client] Error fetching VIP content:', err)
    res.status(500).json({ error: 'Failed to fetch VIP content' })
  }
}










