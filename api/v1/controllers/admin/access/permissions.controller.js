const logger = require('../../../../../config/logger')
const permissionsService = require('../../../services/admin/access/permissions.service')

//# GET /api/v1/admin/permissions
module.exports.index = async (req, res, next) => {
  try {
    const result = await permissionsService.listPermissions({
      ...req.query,
      language: req.get('accept-language')
    })
    res.json(result)
  } catch (err) {
    return next(err)
  }
}

//# POST /api/v1/admin/permissions/create
module.exports.create = async (req, res, next) => {
  try {
    const result = await permissionsService.createPermission(req.body)
    res.status(201).json(result)
  } catch (err) {
    return next(err)
  }
}

//# PATCH /api/v1/admin/permissions/edit/:id
module.exports.edit = async (req, res, next) => {
  try {
    const result = await permissionsService.editPermission(req.params.id, req.body)
    res.status(200).json(result)
  } catch (err) {
    return next(err)
  }
}

//# DELETE /api/v1/admin/permissions/delete/:id
module.exports.delete = async (req, res, next) => {
  try {
    const result = await permissionsService.deletePermission(req.params.id)
    res.status(200).json(result)
  } catch (err) {
    return next(err)
  }
}










