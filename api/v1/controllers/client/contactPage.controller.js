const logger = require('../../../../config/logger')
const contactPageService = require('../../services/contactPage.service')
const getRequestLanguage = require('../../utils/getRequestLanguage')

exports.show = async (req, res) => {
  try {
    const result = await contactPageService.getClientContactPage(getRequestLanguage(req))
    res.status(200).json(result)
  } catch (error) {
    logger.error('[Client] Error retrieving contact page content:', error)
    res.status(500).json({ success: false, message: 'Failed to retrieve contact page content' })
  }
}
