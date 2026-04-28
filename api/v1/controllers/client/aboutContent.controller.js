const logger = require('../../../../config/logger')
const aboutContentService = require('../../services/client/aboutContent.service')
const getRequestLanguage = require('../../utils/getRequestLanguage')

module.exports.index = async (req, res) => {
  try {
    const result = await aboutContentService.getAboutContent(getRequestLanguage(req))
    res.status(200).json(result)
  } catch (err) {
    logger.error('[Client] Error fetching about content:', err)
    res.status(500).json({ error: 'Failed to fetch about content' })
  }
}
