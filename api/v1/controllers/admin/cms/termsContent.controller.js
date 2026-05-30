const logger = require('../../../../../config/logger')
const termsContentService = require('../../../services/admin/cms/termsContent.service')

module.exports.index = async (_req, res, next) => {
  try {
    const result = await termsContentService.getTermsContent()
    res.status(200).json(result)
  } catch (err) {
    return next(err)
  }
}

module.exports.edit = async (req, res, next) => {
  try {
    const result = await termsContentService.updateTermsContent(req.body, req.user)
    res.status(200).json(result)
  } catch (err) {
    return next(err)
  }
}










