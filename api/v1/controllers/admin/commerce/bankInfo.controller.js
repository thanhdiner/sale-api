const logger = require('../../../../../config/logger')
const bankInfoService = require('../../../services/admin/commerce/bankInfo.service')
const getRequestLanguage = require('../../../utils/getRequestLanguage')

// # GET /api/v1/bank-infos
module.exports.getAllBankInfos = async (req, res, next) => {
  try {
    const result = await bankInfoService.listBankInfos(req.query)
    res.json(result)
  } catch (err) {
    return next(err)
  }
}

// # GET /api/v1/bank-infos/active
module.exports.getActiveBankInfo = async (req, res, next) => {
  try {
    const result = await bankInfoService.getActiveBankInfo(getRequestLanguage(req))
    res.json(result)
  } catch (err) {
    return next(err)
  }
}

// # POST /api/v1/bank-infos
module.exports.createBankInfo = async (req, res, next) => {
  try {
    const result = await bankInfoService.createBankInfo(req.body, req.user)
    res.status(201).json(result)
  } catch (err) {
    return next(err)
  }
}

// # PATCH /api/v1/bank-infos/:id
module.exports.updateBankInfo = async (req, res, next) => {
  try {
    const result = await bankInfoService.updateBankInfo(req.params.id, req.body)
    res.json(result)
  } catch (err) {
    return next(err)
  }
}

// # PATCH /api/v1/bank-infos/:id/activate
module.exports.activateBankInfo = async (req, res, next) => {
  try {
    const active = typeof req.body.active !== 'undefined' ? req.body.active : req.query.active
    const result = await bankInfoService.activateBankInfo(req.params.id, active)
    res.json(result)
  } catch (err) {
    return next(err)
  }
}

// # PATCH /api/v1/bank-infos/:id/delete
module.exports.deleteBankInfo = async (req, res, next) => {
  try {
    const result = await bankInfoService.deleteBankInfo(req.params.id, {
      hard: req.query.hard === '1'
    })
    res.json(result)
  } catch (err) {
    return next(err)
  }
}










