const logger = require('../../../../../config/logger')
const termsContentService = require('../../../services/client/cms/termsContent.service')
const getRequestLanguage = require('../../../utils/getRequestLanguage')

module.exports.index = async (req, res, next) => {
  try {
    const result = await termsContentService.getTermsContent(getRequestLanguage(req))
    res.status(200).json(result)
  } catch (err) {
    return next(err)
  }
}










