const logger = require('../../../../config/logger')
const faqPageService = require('../../services/faqPage.service')
const getRequestLanguage = require('../../utils/getRequestLanguage')

exports.show = async (req, res) => {
  try {
    const result = await faqPageService.getClientFaqPage(getRequestLanguage(req))
    res.status(200).json(result)
  } catch (error) {
    logger.error('[Client] Error retrieving FAQ page content:', error)
    res.status(500).json({ success: false, message: 'Failed to retrieve FAQ page content' })
  }
}
