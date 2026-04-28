const logger = require('../../../../config/logger')
const termsContentService = require('../../services/admin/termsContent.service')

module.exports.index = async (_req, res) => {
  try {
    const result = await termsContentService.getTermsContent()
    res.status(200).json(result)
  } catch (err) {
    logger.error('[Admin] Error fetching terms content:', err)
    res.status(500).json({ error: 'Failed to fetch terms content' })
  }
}

module.exports.edit = async (req, res) => {
  try {
    const result = await termsContentService.updateTermsContent(req.body, req.user)
    res.status(200).json(result)
  } catch (err) {
    logger.error('[Admin] Error saving terms content:', err)
    res.status(500).json({ error: 'Failed to save terms content' })
  }
}
