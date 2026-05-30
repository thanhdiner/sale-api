const logger = require('../../../../../config/logger')
const vipContentService = require('../../../services/client/cms/vipContent.service')
const getRequestLanguage = require('../../../utils/getRequestLanguage')

module.exports.index = async (req, res, next) => {
  try {
    const result = await vipContentService.getVipContent(getRequestLanguage(req))
    res.status(200).json(result)
  } catch (err) {
    return next(err)
  }
}










