const logger = require('../../../../config/logger')
const purchaseReceiptsService = require('../../services/admin/purchaseReceipts.service')
const getRequestLanguage = require('../../utils/getRequestLanguage')

const handleKnownControllerError = (res, error) => {
  if (!error?.statusCode) {
    return false
  }

  res.status(error.statusCode).json({ error: error.message })
  return true
}

module.exports.listPurchaseReceipts = async (req, res) => {
  try {
    const result = await purchaseReceiptsService.listPurchaseReceipts(req.query, getRequestLanguage(req))
    res.json(result)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error('[Admin] Error listing purchase receipts:', err)
    res.status(500).json({ error: 'Lỗi lấy danh sách phiếu nhập' })
  }
}

module.exports.createPurchaseReceipt = async (req, res) => {
  try {
    const result = await purchaseReceiptsService.createPurchaseReceipt(req.body, req.user?.userId, getRequestLanguage(req))
    res.json(result)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error('[Admin] Error creating purchase receipt:', err)
    res.status(400).json({ error: err.message || 'Lỗi tạo phiếu nhập' })
  }
}
