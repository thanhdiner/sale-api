const logger = require('../../../../../config/logger')
const homeWhyChooseUsContentService = require('../../../services/client/cms/homeWhyChooseUsContent.service')
const getRequestLanguage = require('../../../utils/getRequestLanguage')

module.exports.index = async (req, res, next) => {
  try {
    const result = await homeWhyChooseUsContentService.getHomeWhyChooseUsContent(getRequestLanguage(req))
    res.status(200).json(result)
  } catch (err) {
    return next(err)
  }
}










