const logger = require('../../../../../config/logger')
const homeBuildYourKitContentService = require('../../../services/client/cms/homeBuildYourKitContent.service')
const getRequestLanguage = require('../../../utils/getRequestLanguage')

module.exports.index = async (req, res, next) => {
  try {
    const result = await homeBuildYourKitContentService.getHomeBuildYourKitContent(getRequestLanguage(req))
    res.status(200).json(result)
  } catch (err) {
    return next(err)
  }
}

