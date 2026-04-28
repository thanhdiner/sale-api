const logger = require('../../../../config/logger')
const footerContentService = require('../../services/footerContent.service')

const handleKnownControllerError = (res, error) => {
  if (!error?.statusCode) return false

  res.status(error.statusCode).json({ success: false, message: error.message })
  return true
}

exports.show = async (_req, res) => {
  try {
    const result = await footerContentService.getAdminFooterContent()
    res.status(200).json(result)
  } catch (error) {
    logger.error('[Admin] Error retrieving footer content:', error)
    res.status(500).json({ success: false, message: 'Failed to retrieve footer content' })
  }
}

exports.update = async (req, res) => {
  try {
    const result = await footerContentService.updateFooterContent(req.body, req.user)
    res.status(200).json(result)
  } catch (error) {
    if (handleKnownControllerError(res, error)) return

    logger.error('[Admin] Error updating footer content:', error)
    res.status(500).json({ success: false, message: 'Failed to update footer content' })
  }
}
