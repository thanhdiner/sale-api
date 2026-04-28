const logger = require('../../../../config/logger')
const privacyPolicyPageService = require('../../services/privacyPolicyPage.service')
const getRequestLanguage = require('../../utils/getRequestLanguage')

exports.show = async (req, res) => {
  try {
    const result = await privacyPolicyPageService.getClientPrivacyPolicyPage(getRequestLanguage(req))
    res.status(200).json(result)
  } catch (error) {
    logger.error('[Client] Error retrieving privacy policy content:', error)
    res.status(500).json({ success: false, message: 'Failed to retrieve privacy policy content' })
  }
}
