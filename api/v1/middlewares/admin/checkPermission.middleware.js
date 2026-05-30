const AppError = require('../../utils/AppError')

const FORBIDDEN_MESSAGE = 'You do not have permission to perform this action'

const normalizePermissions = permissions => (Array.isArray(permissions) ? permissions : [])

const getUserPermissions = user => normalizePermissions(user?.role?.permissions)

const normalizeText = value => String(value || '').trim().toLowerCase()

const isSuperAdmin = user => {
  const role = user?.role
  const roleLabel = normalizeText(role?.label || role?.name || role)
  const username = normalizeText(user?.username)

  return username === 'superadmin' || roleLabel === 'superadmin' || roleLabel === 'super admin'
}

const hasPermission = (user, permission) => {
  if (isSuperAdmin(user)) return true
  return getUserPermissions(user).includes(permission)
}

const deny = next => next(new AppError(FORBIDDEN_MESSAGE, 403))

const checkPermission = permission => (req, res, next) => {
  if (!hasPermission(req.user, permission)) return deny(next)
  next()
}

const checkAnyPermission = permissions => (req, res, next) => {
  const requiredPermissions = normalizePermissions(permissions)

  if (isSuperAdmin(req.user) || requiredPermissions.some(permission => hasPermission(req.user, permission))) {
    return next()
  }

  return deny(next)
}

const checkSelfOrPermission = (permission, getTargetId = req => req.params.id) => (req, res, next) => {
  const targetId = getTargetId(req)

  if (targetId && String(targetId) === String(req.user?.userId)) {
    return next()
  }

  if (hasPermission(req.user, permission)) {
    return next()
  }

  return deny(next)
}

module.exports = {
  checkPermission,
  checkAnyPermission,
  checkSelfOrPermission,
  hasPermission,
  isSuperAdmin
}
