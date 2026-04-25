const logger = require('../../../../config/logger')
const rolesService = require('../../services/admin/roles.service')

const handleKnownControllerError = (res, error) => {
  if (!error?.statusCode) {
    return false
  }

  res.status(error.statusCode).json({
    error: error.message,
    message: error.message
  })
  return true
}

//# GET /api/v1/admin/roles
module.exports.index = async (_req, res) => {
  try {
    const result = await rolesService.listRoles()
    res.json(result)
  } catch (err) {
    logger.error('[Admin] Error getting roles:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

//# POST /api/v1/admin/roles/create
module.exports.create = async (req, res) => {
  try {
    const result = await rolesService.createRole(req.body)
    res.status(201).json(result)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error('[Admin] Error creating role:', err)
    return res.status(500).json({ error: 'Internal server error', message: 'Created unsuccessful' })
  }
}

//# PATCH /api/v1/admin/roles/edit/:id
module.exports.edit = async (req, res) => {
  try {
    const result = await rolesService.editRole(req.params.id, req.body)
    res.status(200).json(result)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error('[Admin] Error editing role:', err)
    return res.status(500).json({ error: 'Internal server error', message: 'Updated unsuccessful' })
  }
}

//# DELETE /api/v1/admin/roles/delete/:id
module.exports.delete = async (req, res) => {
  try {
    const result = await rolesService.deleteRole(req.params.id)
    res.status(200).json(result)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error('[Admin] Error deleting role:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

//# PATCH /api/v1/admin/roles/toggle-active/:id
module.exports.toggleActive = async (req, res) => {
  try {
    const result = await rolesService.toggleRoleActive(req.params.id)
    res.status(200).json(result)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error('[Admin] Error toggling role active:', err)
    res.status(500).json({ error: 'Internal server error', detail: err.message })
  }
}
