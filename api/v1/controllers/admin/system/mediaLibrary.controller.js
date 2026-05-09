const logger = require('../../../../../config/logger')
const mediaLibraryService = require('../../../services/admin/system/mediaLibrary.service')

const handleKnownControllerError = (res, error) => {
  if (!error?.statusCode) return false
  res.status(error.statusCode).json({ message: error.message, details: error.details })
  return true
}

exports.index = async (req, res) => {
  try {
    res.status(200).json(await mediaLibraryService.listAssets(req.query))
  } catch (err) {
    logger.error('[Admin] Error fetching media assets:', err)
    res.status(500).json({ error: 'Failed to fetch media assets' })
  }
}

exports.update = async (req, res) => {
  try {
    res.status(200).json(await mediaLibraryService.updateAsset(req.params.id, req.body))
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error('[Admin] Error updating media asset:', err)
    res.status(500).json({ error: 'Failed to update media asset' })
  }
}

exports.delete = async (req, res) => {
  try {
    res.status(200).json(await mediaLibraryService.deleteAsset(req.params.id))
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error('[Admin] Error deleting media asset:', err)
    res.status(500).json({ error: 'Failed to delete media asset' })
  }
}










