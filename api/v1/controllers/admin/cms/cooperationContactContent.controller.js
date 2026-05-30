const logger = require('../../../../../config/logger')
const cooperationContactContentService = require('../../../services/admin/cms/cooperationContactContent.service')

module.exports.index = async (_req, res, next) => {
  try {
    const result = await cooperationContactContentService.getCooperationContactContent()
    res.status(200).json(result)
  } catch (err) {
    return next(err)
  }
}

module.exports.edit = async (req, res, next) => {
  try {
    const result = await cooperationContactContentService.updateCooperationContactContent(req.body, req.user)
    res.status(200).json(result)
  } catch (err) {
    return next(err)
  }
}










