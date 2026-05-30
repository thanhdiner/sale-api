const logger = require('../../../../../config/logger')
const aboutContentService = require('../../../services/client/cms/aboutContent.service')
const getRequestLanguage = require('../../../utils/getRequestLanguage')

module.exports.index = async (req, res, next) => {
  try {
    const result = await aboutContentService.getAboutContent(getRequestLanguage(req))
    res.status(200).json(result)
  } catch (err) {
    return next(err)
  }
}










