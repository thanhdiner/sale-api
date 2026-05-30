const logger = require('../../../../../config/logger')
const homeBuildYourKitContentService = require('../../../services/admin/cms/homeBuildYourKitContent.service')

module.exports.index = async (_req, res, next) => {
  try {
    const result = await homeBuildYourKitContentService.getHomeBuildYourKitContent()
    res.status(200).json(result)
  } catch (err) {
    return next(err)
  }
}

module.exports.edit = async (req, res, next) => {
  try {
    const result = await homeBuildYourKitContentService.updateHomeBuildYourKitContent(req.body, req.user)
    res.status(200).json(result)
  } catch (err) {
    return next(err)
  }
}

