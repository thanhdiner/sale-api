const logger = require('../../../../config/logger')
const contactPageService = require('../../services/contactPage.service')

const handleKnownControllerError = (res, error) => {
  if (!error?.statusCode) return false

  res.status(error.statusCode).json({ success: false, message: error.message })
  return true
}

exports.show = async (_req, res) => {
  try {
    const result = await contactPageService.getAdminContactPage()
    res.status(200).json(result)
  } catch (error) {
    logger.error('[Admin] Error retrieving contact page content:', error)
    res.status(500).json({ success: false, message: 'Failed to retrieve contact page content' })
  }
}

exports.update = async (req, res) => {
  try {
    const result = await contactPageService.updateContactPage(req.body, req.user)
    res.status(200).json(result)
  } catch (error) {
    if (handleKnownControllerError(res, error)) return

    logger.error('[Admin] Error updating contact page content:', error)
    res.status(500).json({ success: false, message: 'Failed to update contact page content' })
  }
}
