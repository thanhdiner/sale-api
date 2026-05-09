const logger = require('../../../../../config/logger')
const websiteConfigService = require('../../../services/admin/system/websiteConfig.service')

const handleKnownControllerError = (res, error) => {
  if (!error?.statusCode) {
    return false
  }

  res.status(error.statusCode).json({ success: false, message: error.message })
  return true
}

//#GET /api/v1/admin/website-config
exports.index = async (_req, res) => {
  try {
    const config = await websiteConfigService.getWebsiteConfig()
    res.status(200).json(config)
  } catch (error) {
    logger.error('[Admin] Error retrieving website config:', error)
    res.status(500).json({ message: 'Failed to retrieve website config' })
  }
}

//#PATCH /admin/website-config/edit
module.exports.edit = async (req, res) => {
  try {
    const result = await websiteConfigService.updateWebsiteConfig(req.body)
    return res.json(result)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error('[Admin] Update config error:', err)
    res.status(500).json({ success: false, message: 'Cap nhat cau hinh that bai!' })
  }
}










