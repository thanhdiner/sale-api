const logger = require('../../../../../config/logger')
const vipContentService = require('../../../services/admin/cms/vipContent.service')

module.exports.index = async (_req, res) => {
  try {
    const result = await vipContentService.getVipContent()
    res.status(200).json(result)
  } catch (err) {
    logger.error('[Admin] Error fetching VIP content:', err)
    res.status(500).json({ error: 'Failed to fetch VIP content' })
  }
}

module.exports.edit = async (req, res) => {
  try {
    const result = await vipContentService.updateVipContent(req.body, req.user)
    res.status(200).json(result)
  } catch (err) {
    logger.error('[Admin] Error saving VIP content:', err)
    res.status(500).json({ error: 'Failed to save VIP content' })
  }
}










