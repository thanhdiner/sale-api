const logger = require('../../../../../config/logger')
const cooperationContactContentService = require('../../../services/client/cms/cooperationContactContent.service')
const getRequestLanguage = require('../../../utils/getRequestLanguage')

module.exports.index = async (req, res, next) => {
  try {
    const result = await cooperationContactContentService.getCooperationContactContent(getRequestLanguage(req))
    res.status(200).json(result)
  } catch (err) {
    return next(err)
  }
}










