const logger = require('../../../../../config/logger')
const rolesService = require('../../../services/admin/access/roles.service')

//# GET /api/v1/admin/roles
module.exports.index = async (req, res, next) => {
  try {
    const result = await rolesService.listRoles({
      language: req.get('accept-language')
    })
    res.json(result)
  } catch (err) {
    return next(err)
  }
}

//# POST /api/v1/admin/roles/create
module.exports.create = async (req, res, next) => {
  try {
    const result = await rolesService.createRole(req.body)
    res.status(201).json(result)
  } catch (err) {
    return next(err)
  }
}

//# PATCH /api/v1/admin/roles/edit/:id
module.exports.edit = async (req, res, next) => {
  try {
    const result = await rolesService.editRole(req.params.id, req.body)
    res.status(200).json(result)
  } catch (err) {
    return next(err)
  }
}

//# PATCH /api/v1/admin/roles/permissions/:id
module.exports.editPermissions = async (req, res, next) => {
  try {
    const result = await rolesService.editRolePermissions(req.params.id, req.body)
    res.status(200).json(result)
  } catch (err) {
    return next(err)
  }
}

//# DELETE /api/v1/admin/roles/delete/:id
module.exports.delete = async (req, res, next) => {
  try {
    const result = await rolesService.deleteRole(req.params.id)
    res.status(200).json(result)
  } catch (err) {
    return next(err)
  }
}

//# PATCH /api/v1/admin/roles/toggle-active/:id
module.exports.toggleActive = async (req, res, next) => {
  try {
    const result = await rolesService.toggleRoleActive(req.params.id)
    res.status(200).json(result)
  } catch (err) {
    return next(err)
  }
}










