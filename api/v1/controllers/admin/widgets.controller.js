const logger = require('../../../../config/logger')
const widgetsService = require('../../services/admin/widgets.service')

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

//# GET /api/v1/admin/widgets
module.exports.index = async (req, res) => {
  try {
    const result = await widgetsService.listWidgets(req.query)
    res.status(200).json(result)
  } catch (err) {
    logger.error('[Admin] Error fetching widgets:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

//# POST /api/v1/admin/widgets
module.exports.create = async (req, res) => {
  try {
    const result = await widgetsService.createWidget(req.body, req.user)
    res.status(201).json(result)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error('[Admin] Error creating widget:', err)
    res.status(500).json({ error: 'Failed to create widget' })
  }
}

//# PATCH /api/v1/admin/widgets/:id
module.exports.edit = async (req, res) => {
  try {
    const result = await widgetsService.updateWidget(req.params.id, req.body, req.user)
    res.status(200).json(result)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error('[Admin] Error updating widget:', err)
    res.status(500).json({ error: 'Failed to update widget' })
  }
}

//# DELETE /api/v1/admin/widgets/:id
module.exports.delete = async (req, res) => {
  try {
    const result = await widgetsService.deleteWidget(req.params.id)
    res.status(200).json(result)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error('[Admin] Error deleting widget:', err)
    res.status(500).json({ error: 'Failed to delete widget' })
  }
}
