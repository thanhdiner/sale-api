const logger = require('../../../../../config/logger')
const bankInfoService = require('../../../services/client/commerce/bankInfo.service')
const getRequestLanguage = require('../../../utils/getRequestLanguage')

const handleKnownControllerError = (res, error) => {
  if (!error?.statusCode) {
    return false
  }

  res.status(error.statusCode).json({ error: error.message })
  return true
}

// # GET /api/v1/client/bank-info/active
module.exports.getActiveBankInfo = async (req, res) => {
  try {
    const result = await bankInfoService.getActiveBankInfo(getRequestLanguage(req))
    res.json(result)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error('[Client] Error fetching active bank info:', err)
    res.status(500).json({ error: 'Lỗi lấy bank info đang dùng' })
  }
}










