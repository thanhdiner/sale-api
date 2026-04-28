const logger = require('../../../../config/logger')
const gameAccountContentService = require('../../services/gameAccountContent.service')
const getRequestLanguage = require('../../utils/getRequestLanguage')

exports.show = async (req, res) => {
  try {
    const result = await gameAccountContentService.getClientGameAccountContent(getRequestLanguage(req))
    res.status(200).json(result)
  } catch (error) {
    logger.error('[Client] Error retrieving game account content:', error)
    res.status(500).json({ success: false, message: 'Failed to retrieve game account content' })
  }
}
