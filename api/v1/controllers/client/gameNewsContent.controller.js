const logger = require('../../../../config/logger')
const gameNewsContentService = require('../../services/gameNewsContent.service')
const getRequestLanguage = require('../../utils/getRequestLanguage')

exports.show = async (req, res) => {
  try {
    const result = await gameNewsContentService.getClientGameNewsContent(getRequestLanguage(req))
    res.status(200).json(result)
  } catch (error) {
    logger.error('[Client] Error retrieving game news content:', error)
    res.status(500).json({ success: false, message: 'Failed to retrieve game news content' })
  }
}
