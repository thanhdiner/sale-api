const logger = require('../../../../../config/logger')
const homeWhyChooseUsContentService = require('../../../services/admin/cms/homeWhyChooseUsContent.service')

module.exports.index = async (_req, res, next) => {
  try {
    const result = await homeWhyChooseUsContentService.getHomeWhyChooseUsContent()
    res.status(200).json(result)
  } catch (err) {
    return next(err)
  }
}

module.exports.edit = async (req, res, next) => {
  try {
    const result = await homeWhyChooseUsContentService.updateHomeWhyChooseUsContent(req.body, req.user)
    res.status(200).json(result)
  } catch (err) {
    return next(err)
  }
}










