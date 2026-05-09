const logger = require('../../../../../config/logger')
const cmsRevisionService = require('../../../services/admin/cms/cmsRevision.service')

const handleKnownControllerError = (res, error) => {
  if (!error?.statusCode) return false
  res.status(error.statusCode).json({ message: error.message, details: error.details })
  return true
}

exports.index = async (req, res) => {
  try {
    res.status(200).json(await cmsRevisionService.listRevisions(req.query))
  } catch (err) {
    logger.error('[Admin] Error fetching CMS revisions:', err)
    res.status(500).json({ error: 'Failed to fetch CMS revisions' })
  }
}

exports.restore = async (req, res) => {
  try {
    res.status(200).json(await cmsRevisionService.restoreRevision(req.params.id, req.user))
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error('[Admin] Error restoring CMS revision:', err)
    res.status(500).json({ error: 'Failed to restore CMS revision' })
  }
}










