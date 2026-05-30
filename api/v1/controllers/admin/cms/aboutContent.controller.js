const logger = require('../../../../../config/logger')
const aboutContentService = require('../../../services/admin/cms/aboutContent.service')

module.exports.index = async (_req, res, next) => {
  try {
    const result = await aboutContentService.getAboutContent()
    res.status(200).json(result)
  } catch (err) {
    return next(err)
  }
}

module.exports.edit = async (req, res, next) => {
  try {
    const result = await aboutContentService.updateAboutContent(req.body, req.user)
    res.status(200).json(result)
  } catch (err) {
    return next(err)
  }
}










