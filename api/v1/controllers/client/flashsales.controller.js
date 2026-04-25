const flashSalesService = require('../../services/client/flashSales.service')

module.exports.index = async (req, res) => {
  try {
    const result = await flashSalesService.listFlashSales(req.query)
    res.json(result)
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err })
  }
}

module.exports.detail = async (req, res) => {
  try {
    const result = await flashSalesService.getFlashSaleDetail(req.params.id)
    res.json(result)
  } catch (err) {
    if (err?.statusCode) {
      return res.status(err.statusCode).json({ message: err.message })
    }
    res.status(500).json({ message: 'Server error', error: err })
  }
}
