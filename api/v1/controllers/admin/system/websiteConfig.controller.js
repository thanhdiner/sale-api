const logger = require('../../../../../config/logger')
const websiteConfigService = require('../../../services/admin/system/websiteConfig.service')

//#GET /api/v1/admin/website-config
exports.index = async (_req, res, next) => {
  try {
    const config = await websiteConfigService.getWebsiteConfig()
    res.status(200).json(config)
  } catch (error) {
    return next(error)
  }
}

//#PATCH /admin/website-config/edit
module.exports.edit = async (req, res, next) => {
  try {
    const result = await websiteConfigService.updateWebsiteConfig(req.body)
    return res.json(result)
  } catch (err) {
    return next(err)
  }
}










