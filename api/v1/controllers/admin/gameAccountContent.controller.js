const logger = require('../../../../config/logger')
const gameAccountContentService = require('../../services/gameAccountContent.service')

exports.show = async (_req, res) => {
  try {
    const result = await gameAccountContentService.getAdminGameAccountContent()
    res.status(200).json(result)
  } catch (error) {
    logger.error('[Admin] Error retrieving game account content:', error)
    res.status(500).json({ success: false, message: 'Failed to retrieve game account content' })
  }
}

exports.update = async (req, res) => {
  try {
    const result = await gameAccountContentService.updateGameAccountContent(req.body, req.user)
    res.status(200).json(result)
  } catch (error) {
    logger.error('[Admin] Error updating game account content:', error)
    res.status(500).json({ success: false, message: 'Failed to update game account content' })
  }
}
