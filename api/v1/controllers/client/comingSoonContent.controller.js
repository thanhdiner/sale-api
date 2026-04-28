const logger = require('../../../../config/logger')
const comingSoonContentService = require('../../services/comingSoonContent.service')
const getRequestLanguage = require('../../utils/getRequestLanguage')

const handleKnownControllerError = (res, error) => {
  if (!error?.statusCode) return false

  res.status(error.statusCode).json({ success: false, message: error.message })
  return true
}

exports.show = async (req, res) => {
  try {
    const result = await comingSoonContentService.getClientComingSoonContent(req.params.key, getRequestLanguage(req))
    res.status(200).json(result)
  } catch (error) {
    if (handleKnownControllerError(res, error)) return

    logger.error('[Client] Error retrieving coming soon content:', error)
    res.status(500).json({ success: false, message: 'Failed to retrieve coming soon content' })
  }
}
