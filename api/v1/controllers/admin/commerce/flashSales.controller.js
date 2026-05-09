const logger = require('../../../../../config/logger')
const flashSalesService = require('../../../services/admin/commerce/flashSales.service')

const handleKnownControllerError = (res, error) => {
  if (!error?.statusCode) {
    return false
  }

  res.status(error.statusCode).json({ message: error.message })
  return true
}

//# GET /api/v1/admin/flashsales
module.exports.index = async (req, res) => {
  try {
    const result = await flashSalesService.listFlashSales(req.query)
    res.json(result)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error('[Admin] Flash sale index error:', err)
    res.status(500).json({ message: 'Server error', error: err })
  }
}

//# GET /api/v1/admin/flashsales/:id
module.exports.detail = async (req, res) => {
  try {
    const result = await flashSalesService.getFlashSaleDetail(req.params.id)
    res.json(result)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error('[Admin] Flash sale detail error:', err)
    res.status(500).json({ message: 'Server error', error: err })
  }
}

//# POST /api/v1/admin/flashsales/create
module.exports.create = async (req, res) => {
  try {
    const result = await flashSalesService.createFlashSale(req.body)
    res.status(201).json(result)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error('[Admin] Flash sale create error:', err)
    res.status(500).json({ message: 'Server error', error: err })
  }
}

//# PATCH /api/v1/admin/flashsales/edit/:id
module.exports.edit = async (req, res) => {
  try {
    const result = await flashSalesService.updateFlashSale(req.params.id, req.body)
    res.json(result)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error('[Admin] Flash sale edit error:', err)
    res.status(500).json({ message: 'Server error', error: err })
  }
}

//# DELETE /api/v1/admin/flashsales/delete/:id
module.exports.delete = async (req, res) => {
  try {
    const result = await flashSalesService.deleteFlashSale(req.params.id)
    res.json(result)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error('[Admin] Flash sale delete error:', err)
    res.status(500).json({ message: 'Server error', error: err })
  }
}

//# PATCH /api/v1/admin/flashsales/delete-many
module.exports.deleteMany = async (req, res) => {
  try {
    const result = await flashSalesService.deleteManyFlashSales(req.body.ids)
    res.json(result)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error('[Admin] Flash sale deleteMany error:', err)
    res.status(500).json({ message: 'Server error', error: err })
  }
}

//# PATCH /api/v1/admin/flashsales/changeStatus/:id
module.exports.changeStatus = async (req, res) => {
  try {
    const result = await flashSalesService.changeFlashSaleStatus(req.params.id, req.body.status)
    res.json(result)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error('[Admin] Flash sale changeStatus error:', err)
    res.status(500).json({ message: 'Server error', error: err })
  }
}

//# PATCH /api/v1/admin/flashsales/change-status-many
module.exports.changeStatusMany = async (req, res) => {
  try {
    const result = await flashSalesService.changeFlashSaleStatusMany(req.body.ids, req.body.status)
    res.json(result)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error('[Admin] Flash sale changeStatusMany error:', err)
    res.status(500).json({ message: 'Server error', error: err })
  }
}

//# PATCH /api/v1/admin/flashsales/change-position-many
module.exports.changePositionMany = async (req, res) => {
  try {
    const result = await flashSalesService.changeFlashSalePositionMany(req.body.items)
    res.json(result)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error('[Admin] Flash sale changePositionMany error:', err)
    res.status(500).json({ message: 'Server error', error: err })
  }
}










