const logger = require('../../../../config/logger')
const bankInfoService = require('../../services/admin/bankInfo.service')

const handleKnownControllerError = (res, error) => {
  if (!error?.statusCode) {
    return false
  }

  const payload = { error: error.message }
  if (error.details) {
    payload.detail = error.details
  }

  res.status(error.statusCode).json(payload)
  return true
}

// # GET /api/v1/bank-infos
module.exports.getAllBankInfos = async (req, res) => {
  try {
    const result = await bankInfoService.listBankInfos(req.query)
    res.json(result)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error('[Admin] getAllBankInfos error:', err)
    res.status(500).json({ error: 'Lỗi lấy danh sách bank info' })
  }
}

// # GET /api/v1/bank-infos/active
module.exports.getActiveBankInfo = async (_req, res) => {
  try {
    const result = await bankInfoService.getActiveBankInfo()
    res.json(result)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error('[Admin] getActiveBankInfo error:', err)
    res.status(500).json({ error: 'Lỗi lấy bank info đang dùng' })
  }
}

// # POST /api/v1/bank-infos
module.exports.createBankInfo = async (req, res) => {
  try {
    const result = await bankInfoService.createBankInfo(req.body, req.user)
    res.status(201).json(result)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error('[Admin] createBankInfo error:', err)
    res.status(500).json({ error: 'Lỗi tạo bank info' })
  }
}

// # PATCH /api/v1/bank-infos/:id
module.exports.updateBankInfo = async (req, res) => {
  try {
    const result = await bankInfoService.updateBankInfo(req.params.id, req.body)
    res.json(result)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error('[Admin] updateBankInfo error:', err)
    res.status(500).json({ error: 'Lỗi cập nhật bank info' })
  }
}

// # PATCH /api/v1/bank-infos/:id/activate
module.exports.activateBankInfo = async (req, res) => {
  try {
    const active = typeof req.body.active !== 'undefined' ? req.body.active : req.query.active
    const result = await bankInfoService.activateBankInfo(req.params.id, active)
    res.json(result)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error('[Admin] activateBankInfo error:', err)
    res.status(500).json({ error: 'Lỗi kích hoạt bank info' })
  }
}

// # PATCH /api/v1/bank-infos/:id/delete
module.exports.deleteBankInfo = async (req, res) => {
  try {
    const result = await bankInfoService.deleteBankInfo(req.params.id, {
      hard: req.query.hard === '1'
    })
    res.json(result)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error('[Admin] deleteBankInfo error:', err)
    res.status(500).json({ error: 'Lỗi xóa bank info' })
  }
}
