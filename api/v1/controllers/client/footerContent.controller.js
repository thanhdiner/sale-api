const logger = require('../../../../config/logger')
const footerContentService = require('../../services/footerContent.service')
const getRequestLanguage = require('../../utils/getRequestLanguage')

exports.show = async (req, res) => {
  try {
    const result = await footerContentService.getClientFooterContent(getRequestLanguage(req))
    res.status(200).json(result)
  } catch (error) {
    logger.error('[Client] Error retrieving footer content:', error)
    res.status(500).json({ success: false, message: 'Failed to retrieve footer content' })
  }
}
