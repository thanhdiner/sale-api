const logger = require('../../../../config/logger')
const returnPolicyPageService = require('../../services/returnPolicyPage.service')

const handleKnownControllerError = (res, error) => {
  if (!error?.statusCode) return false

  res.status(error.statusCode).json({ success: false, message: error.message })
  return true
}

exports.show = async (_req, res) => {
  try {
    const result = await returnPolicyPageService.getAdminReturnPolicyPage()
    res.status(200).json(result)
  } catch (error) {
    logger.error('[Admin] Error retrieving return policy page content:', error)
    res.status(500).json({ success: false, message: 'Failed to retrieve return policy page content' })
  }
}

exports.update = async (req, res) => {
  try {
    const result = await returnPolicyPageService.updateReturnPolicyPage(req.body, req.user)
    res.status(200).json(result)
  } catch (error) {
    if (handleKnownControllerError(res, error)) return

    logger.error('[Admin] Error updating return policy page content:', error)
    res.status(500).json({ success: false, message: 'Failed to update return policy page content' })
  }
}
