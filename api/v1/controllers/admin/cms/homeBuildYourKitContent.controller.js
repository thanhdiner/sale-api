const logger = require('../../../../../config/logger')
const homeBuildYourKitContentService = require('../../../services/admin/cms/homeBuildYourKitContent.service')

module.exports.index = async (_req, res) => {
  try {
    const result = await homeBuildYourKitContentService.getHomeBuildYourKitContent()
    res.status(200).json(result)
  } catch (err) {
    logger.error('[Admin] Error fetching home build your kit content:', err)
    res.status(500).json({ error: 'Failed to fetch home build your kit content' })
  }
}

module.exports.edit = async (req, res) => {
  try {
    const result = await homeBuildYourKitContentService.updateHomeBuildYourKitContent(req.body, req.user)
    res.status(200).json(result)
  } catch (err) {
    logger.error('[Admin] Error saving home build your kit content:', err)
    res.status(500).json({ error: 'Failed to save home build your kit content' })
  }
}

