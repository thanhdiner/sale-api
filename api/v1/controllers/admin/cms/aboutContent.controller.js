const logger = require('../../../../../config/logger')
const aboutContentService = require('../../../services/admin/cms/aboutContent.service')

module.exports.index = async (_req, res) => {
  try {
    const result = await aboutContentService.getAboutContent()
    res.status(200).json(result)
  } catch (err) {
    logger.error('[Admin] Error fetching about content:', err)
    res.status(500).json({ error: 'Failed to fetch about content' })
  }
}

module.exports.edit = async (req, res) => {
  try {
    const result = await aboutContentService.updateAboutContent(req.body, req.user)
    res.status(200).json(result)
  } catch (err) {
    logger.error('[Admin] Error saving about content:', err)
    res.status(500).json({ error: 'Failed to save about content' })
  }
}










