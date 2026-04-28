const logger = require('../../../../config/logger')
const termsContentService = require('../../services/client/termsContent.service')
const getRequestLanguage = require('../../utils/getRequestLanguage')

module.exports.index = async (req, res) => {
  try {
    const result = await termsContentService.getTermsContent(getRequestLanguage(req))
    res.status(200).json(result)
  } catch (err) {
    logger.error('[Client] Error fetching terms content:', err)
    res.status(500).json({ error: 'Failed to fetch terms content' })
  }
}
