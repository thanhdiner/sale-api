const logger = require('../../../../../config/logger')
const homeBuildYourKitContentService = require('../../../services/client/cms/homeBuildYourKitContent.service')
const getRequestLanguage = require('../../../utils/getRequestLanguage')

module.exports.index = async (req, res) => {
  try {
    const result = await homeBuildYourKitContentService.getHomeBuildYourKitContent(getRequestLanguage(req))
    res.status(200).json(result)
  } catch (err) {
    logger.error('[Client] Error fetching home build your kit content:', err)
    res.status(500).json({ error: 'Failed to fetch home build your kit content' })
  }
}

