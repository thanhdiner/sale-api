const logger = require('../../../../config/logger')
const homeWhyChooseUsContentService = require('../../services/admin/homeWhyChooseUsContent.service')

module.exports.index = async (_req, res) => {
  try {
    const result = await homeWhyChooseUsContentService.getHomeWhyChooseUsContent()
    res.status(200).json(result)
  } catch (err) {
    logger.error('[Admin] Error fetching home why choose us content:', err)
    res.status(500).json({ error: 'Failed to fetch home why choose us content' })
  }
}

module.exports.edit = async (req, res) => {
  try {
    const result = await homeWhyChooseUsContentService.updateHomeWhyChooseUsContent(req.body, req.user)
    res.status(200).json(result)
  } catch (err) {
    logger.error('[Admin] Error saving home why choose us content:', err)
    res.status(500).json({ error: 'Failed to save home why choose us content' })
  }
}
