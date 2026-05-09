const logger = require('../../../../../config/logger')
const permissionGroupsService = require('../../../services/admin/access/permissionGroups.service')

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

//# GET /api/v1/admin/permission-groups
module.exports.index = async (req, res) => {
  try {
    const result = await permissionGroupsService.listPermissionGroups({
      language: req.get('accept-language')
    })
    res.json(result)
  } catch (err) {
    logger.error('[Admin] Error getting permission groups:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

//# POST /api/v1/admin/permission-groups/create
module.exports.create = async (req, res) => {
  try {
    const result = await permissionGroupsService.createPermissionGroup(req.body)
    res.status(201).json(result)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error('[Admin] Error creating permission group:', err)
    return res.status(500).json({ error: 'Internal server error', message: 'Created unsuccessful', status: 500 })
  }
}

//# PATCH /api/v1/admin/permissions/edit/:id
module.exports.edit = async (req, res) => {
  try {
    const result = await permissionGroupsService.editPermissionGroup(req.params.id, req.body)
    res.status(200).json(result)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error('[Admin] Error editing permission group:', err)
    return res.status(500).json({ error: 'Internal server error', message: 'Updated unsuccessful', status: 500 })
  }
}

//# PATCH /api/v1/admin/permission-groups/delete/:id
module.exports.delete = async (req, res) => {
  try {
    const result = await permissionGroupsService.deletePermissionGroup(req.params.id)
    res.status(200).json(result)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error('[Admin] Error deleting permission group:', err)
    res.status(500).json({ error: 'Internal server error', status: 500 })
  }
}

//# PATCH /api/v1/admin/permissions/toggle-active/:id
module.exports.toggleActive = async (req, res) => {
  try {
    const result = await permissionGroupsService.togglePermissionGroupActive(
      req.params.id,
      req.body.isActive
    )
    res.status(200).json(result)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error('[Admin] Error toggling permission group active state:', err)
    return res.status(500).json({ error: 'Internal server error', message: 'Updated unsuccessful', status: 500 })
  }
}










