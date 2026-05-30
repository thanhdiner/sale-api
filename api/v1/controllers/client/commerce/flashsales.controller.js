const flashSalesService = require('../../../services/client/commerce/flashSales.service')

module.exports.index = async (req, res, next) => {
  try {
    const result = await flashSalesService.listFlashSales(req.query)
    res.json(result)
  } catch (err) {
    return next(err)
  }
}

module.exports.detail = async (req, res, next) => {
  try {
    const result = await flashSalesService.getFlashSaleDetail(req.params.id)
    res.json(result)
  } catch (err) {
    return next(err)
  }
}










