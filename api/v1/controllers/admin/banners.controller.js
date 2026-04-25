const logger = require('../../../../config/logger')
const bannersService = require('../../services/admin/banners.service')

const handleKnownControllerError = (res, error) => {
  if (!error?.statusCode) {
    return false
  }

  const payload = { message: error.message }
  if (error.details) {
    payload.details = error.details
  }

  res.status(error.statusCode).json(payload)
  return true
}

//# GET /api/v1/admin/banners
module.exports.index = async (_req, res) => {
  try {
    const result = await bannersService.listBanners()
    res.status(200).json(result)
  } catch (err) {
    logger.error('[Admin] Error fetching banners:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

//# POST /api/v1/admin/banners
module.exports.create = async (req, res) => {
  try {
    const result = await bannersService.createBanner(req.body, req.user)
    res.status(201).json(result)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error('[Admin] Error creating banner:', err)
    res.status(500).json({ error: 'Failed to create banner' })
  }
}

//# PATCH /api/v1/admin/banners/:id
module.exports.edit = async (req, res) => {
  try {
    const result = await bannersService.updateBanner(req.params.id, req.body, req.user)
    res.status(200).json(result)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error('[Admin] Error updating banner:', err)
    res.status(500).json({ error: 'Failed to update banner' })
  }
}

//# DELETE /api/v1/admin/banners/:id
module.exports.delete = async (req, res) => {
  try {
    const result = await bannersService.deleteBanner(req.params.id)
    res.status(200).json(result)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error('[Admin] Error deleting banner:', err)
    res.status(500).json({ error: 'Failed to delete banner' })
  }
}
