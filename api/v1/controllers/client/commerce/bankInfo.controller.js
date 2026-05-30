const logger = require('../../../../../config/logger')
const bankInfoService = require('../../../services/client/commerce/bankInfo.service')
const getRequestLanguage = require('../../../utils/getRequestLanguage')

// # GET /api/v1/client/bank-info/active
module.exports.getActiveBankInfo = async (req, res, next) => {
  try {
    const result = await bankInfoService.getActiveBankInfo(getRequestLanguage(req))
    res.json(result)
  } catch (err) {
    return next(err)
  }
}










