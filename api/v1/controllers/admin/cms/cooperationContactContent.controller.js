const logger = require('../../../../../config/logger')
const cooperationContactContentService = require('../../../services/admin/cms/cooperationContactContent.service')

module.exports.index = async (_req, res) => {
  try {
    const result = await cooperationContactContentService.getCooperationContactContent()
    res.status(200).json(result)
  } catch (err) {
    logger.error('[Admin] Error fetching cooperation contact content:', err)
    res.status(500).json({ error: 'Failed to fetch cooperation contact content' })
  }
}

module.exports.edit = async (req, res) => {
  try {
    const result = await cooperationContactContentService.updateCooperationContactContent(req.body, req.user)
    res.status(200).json(result)
  } catch (err) {
    logger.error('[Admin] Error saving cooperation contact content:', err)
    res.status(500).json({ error: 'Failed to save cooperation contact content' })
  }
}










