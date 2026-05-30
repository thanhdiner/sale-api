const logger = require('../../../../../config/logger')
const bannersService = require('../../../services/admin/system/banners.service')

//# GET /api/v1/admin/banners
module.exports.index = async (_req, res, next) => {
  try {
    const result = await bannersService.listBanners()
    res.status(200).json(result)
  } catch (err) {
    return next(err)
  }
}

//# POST /api/v1/admin/banners
module.exports.create = async (req, res, next) => {
  try {
    const result = await bannersService.createBanner(req.body, req.user)
    res.status(201).json(result)
  } catch (err) {
    return next(err)
  }
}

//# PATCH /api/v1/admin/banners/:id
module.exports.edit = async (req, res, next) => {
  try {
    const result = await bannersService.updateBanner(req.params.id, req.body, req.user)
    res.status(200).json(result)
  } catch (err) {
    return next(err)
  }
}

//# DELETE /api/v1/admin/banners/:id
module.exports.delete = async (req, res, next) => {
  try {
    const result = await bannersService.deleteBanner(req.params.id)
    res.status(200).json(result)
  } catch (err) {
    return next(err)
  }
}










