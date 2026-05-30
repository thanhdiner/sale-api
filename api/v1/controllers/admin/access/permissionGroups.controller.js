const logger = require('../../../../../config/logger')
const permissionGroupsService = require('../../../services/admin/access/permissionGroups.service')

//# GET /api/v1/admin/permission-groups
module.exports.index = async (req, res, next) => {
  try {
    const result = await permissionGroupsService.listPermissionGroups({
      language: req.get('accept-language')
    })
    res.json(result)
  } catch (err) {
    return next(err)
  }
}

//# POST /api/v1/admin/permission-groups/create
module.exports.create = async (req, res, next) => {
  try {
    const result = await permissionGroupsService.createPermissionGroup(req.body)
    res.status(201).json(result)
  } catch (err) {
    return next(err)
  }
}

//# PATCH /api/v1/admin/permissions/edit/:id
module.exports.edit = async (req, res, next) => {
  try {
    const result = await permissionGroupsService.editPermissionGroup(req.params.id, req.body)
    res.status(200).json(result)
  } catch (err) {
    return next(err)
  }
}

//# PATCH /api/v1/admin/permission-groups/delete/:id
module.exports.delete = async (req, res, next) => {
  try {
    const result = await permissionGroupsService.deletePermissionGroup(req.params.id)
    res.status(200).json(result)
  } catch (err) {
    return next(err)
  }
}

//# PATCH /api/v1/admin/permissions/toggle-active/:id
module.exports.toggleActive = async (req, res, next) => {
  try {
    const result = await permissionGroupsService.togglePermissionGroupActive(
      req.params.id,
      req.body.isActive
    )
    res.status(200).json(result)
  } catch (err) {
    return next(err)
  }
}










