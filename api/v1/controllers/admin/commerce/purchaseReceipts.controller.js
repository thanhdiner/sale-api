const logger = require('../../../../../config/logger')
const purchaseReceiptsService = require('../../../services/admin/commerce/purchaseReceipts.service')
const getRequestLanguage = require('../../../utils/getRequestLanguage')


module.exports.listPurchaseReceipts = async (req, res, next) => {
  try {
    const result = await purchaseReceiptsService.listPurchaseReceipts(req.query, getRequestLanguage(req))
    res.json(result)
  } catch (err) {
    return next(err)
  }
}

module.exports.createPurchaseReceipt = async (req, res, next) => {
  try {
    const result = await purchaseReceiptsService.createPurchaseReceipt(req.body, req.user?.userId, getRequestLanguage(req))
    res.json(result)
  } catch (err) {
    return next(err)
  }
}

module.exports.cancelPurchaseReceipt = async (req, res, next) => {
  try {
    const result = await purchaseReceiptsService.cancelPurchaseReceipt(req.params.id, req.body, req.user, getRequestLanguage(req))
    res.json(result)
  } catch (err) {
    return next(err)
  }
}










