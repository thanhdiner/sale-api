const logger = require('../../../../../config/logger')
const vipContentService = require('../../../services/admin/cms/vipContent.service')

module.exports.index = async (_req, res, next) => {
  try {
    const result = await vipContentService.getVipContent()
    res.status(200).json(result)
  } catch (err) {
    return next(err)
  }
}

module.exports.edit = async (req, res, next) => {
  try {
    const result = await vipContentService.updateVipContent(req.body, req.user)
    res.status(200).json(result)
  } catch (err) {
    return next(err)
  }
}










