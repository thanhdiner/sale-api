const logger = require('../../../../../config/logger')
const permissionsService = require('../../../services/admin/access/permissions.service')

const handleKnownControllerError = (res, error) => {
  if (!error?.statusCode) {
    return false
  }

  res.status(error.statusCode).json({ error: error.message })
  return true
}

//# GET /api/v1/admin/permissions
module.exports.index = async (req, res) => {
  try {
    const result = await permissionsService.listPermissions({
      ...req.query,
      language: req.get('accept-language')
    })
    res.json(result)
  } catch (err) {
    logger.error('[Admin] Error getting permissions:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

//# POST /api/v1/admin/permissions/create
module.exports.create = async (req, res) => {
  try {
    const result = await permissionsService.createPermission(req.body)
    res.status(201).json(result)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error('[Admin] Error creating permission:', err)
    return res.status(500).json({ error: 'Internal server error', message: 'Created unsuccessful', status: 500 })
  }
}

//# PATCH /api/v1/admin/permissions/edit/:id
module.exports.edit = async (req, res) => {
  try {
    const result = await permissionsService.editPermission(req.params.id, req.body)
    res.status(200).json(result)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error('[Admin] Error editing permission:', err)
    return res.status(500).json({ error: 'Internal server error', message: 'Updated unsuccessful', status: 500 })
  }
}

//# DELETE /api/v1/admin/permissions/delete/:id
module.exports.delete = async (req, res) => {
  try {
    const result = await permissionsService.deletePermission(req.params.id)
    res.status(200).json(result)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error('[Admin] Error deleting permission:', err)
    res.status(500).json({ error: 'Internal server error', status: 500 })
  }
}










