const logger = require('../../../../config/logger')
const privacyPolicyPageService = require('../../services/privacyPolicyPage.service')

const handleKnownControllerError = (res, error) => {
  if (!error?.statusCode) return false

  res.status(error.statusCode).json({ success: false, message: error.message })
  return true
}

exports.show = async (_req, res) => {
  try {
    const result = await privacyPolicyPageService.getAdminPrivacyPolicyPage()
    res.status(200).json(result)
  } catch (error) {
    logger.error('[Admin] Error retrieving privacy policy content:', error)
    res.status(500).json({ success: false, message: 'Failed to retrieve privacy policy content' })
  }
}

exports.update = async (req, res) => {
  try {
    const result = await privacyPolicyPageService.updatePrivacyPolicyPage(req.body, req.user)
    res.status(200).json(result)
  } catch (error) {
    if (handleKnownControllerError(res, error)) return

    logger.error('[Admin] Error updating privacy policy content:', error)
    res.status(500).json({ success: false, message: 'Failed to update privacy policy content' })
  }
}
