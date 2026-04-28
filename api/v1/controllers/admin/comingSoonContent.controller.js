const logger = require('../../../../config/logger')
const comingSoonContentService = require('../../services/comingSoonContent.service')

const handleKnownControllerError = (res, error) => {
  if (!error?.statusCode) return false

  res.status(error.statusCode).json({ success: false, message: error.message })
  return true
}

exports.show = async (req, res) => {
  try {
    const result = await comingSoonContentService.getAdminComingSoonContent(req.params.key)
    res.status(200).json(result)
  } catch (error) {
    if (handleKnownControllerError(res, error)) return

    logger.error('[Admin] Error retrieving coming soon content:', error)
    res.status(500).json({ success: false, message: 'Failed to retrieve coming soon content' })
  }
}

exports.update = async (req, res) => {
  try {
    const result = await comingSoonContentService.updateComingSoonContent(req.params.key, req.body, req.user)
    res.status(200).json(result)
  } catch (error) {
    if (handleKnownControllerError(res, error)) return

    logger.error('[Admin] Error updating coming soon content:', error)
    res.status(500).json({ success: false, message: 'Failed to update coming soon content' })
  }
}
