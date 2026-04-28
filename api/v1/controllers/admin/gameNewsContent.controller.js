const logger = require('../../../../config/logger')
const gameNewsContentService = require('../../services/gameNewsContent.service')

exports.show = async (_req, res) => {
  try {
    const result = await gameNewsContentService.getAdminGameNewsContent()
    res.status(200).json(result)
  } catch (error) {
    logger.error('[Admin] Error retrieving game news content:', error)
    res.status(500).json({ success: false, message: 'Failed to retrieve game news content' })
  }
}

exports.update = async (req, res) => {
  try {
    const result = await gameNewsContentService.updateGameNewsContent(req.body, req.user)
    res.status(200).json(result)
  } catch (error) {
    logger.error('[Admin] Error updating game news content:', error)
    res.status(500).json({ success: false, message: 'Failed to update game news content' })
  }
}
