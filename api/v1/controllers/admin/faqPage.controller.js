const logger = require('../../../../config/logger')
const faqPageService = require('../../services/faqPage.service')

const handleKnownControllerError = (res, error) => {
  if (!error?.statusCode) return false

  res.status(error.statusCode).json({ success: false, message: error.message })
  return true
}

exports.show = async (_req, res) => {
  try {
    const result = await faqPageService.getAdminFaqPage()
    res.status(200).json(result)
  } catch (error) {
    logger.error('[Admin] Error retrieving FAQ page content:', error)
    res.status(500).json({ success: false, message: 'Failed to retrieve FAQ page content' })
  }
}

exports.update = async (req, res) => {
  try {
    const result = await faqPageService.updateFaqPage(req.body, req.user)
    res.status(200).json(result)
  } catch (error) {
    if (handleKnownControllerError(res, error)) return

    logger.error('[Admin] Error updating FAQ page content:', error)
    res.status(500).json({ success: false, message: 'Failed to update FAQ page content' })
  }
}
