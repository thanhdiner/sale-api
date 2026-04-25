const logger = require('../../../../config/logger')
const meService = require('../../services/admin/me.service')

const handleKnownControllerError = (res, error) => {
  if (!error?.statusCode) {
    return false
  }

  res.status(error.statusCode).json({ error: error.message })
  return true
}

//# GET /api/v1/admin/me
module.exports.index = async (req, res) => {
  try {
    const admin = await meService.getCurrentAdminProfile(req.user?.userId)
    res.json(admin)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error('[Admin] Error getting current admin profile:', err)
    res.status(500).json({ error: 'Server error' })
  }
}
