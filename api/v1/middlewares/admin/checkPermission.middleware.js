const FORBIDDEN_MESSAGE = 'Bạn không có quyền thực hiện thao tác này'

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

const deny = res => res.status(403).json({ error: FORBIDDEN_MESSAGE })

const checkPermission = permission => (req, res, next) => {
  if (!hasPermission(req.user, permission)) return deny(res)
  next()
}

const checkAnyPermission = permissions => (req, res, next) => {
  const requiredPermissions = normalizePermissions(permissions)

  if (isSuperAdmin(req.user) || requiredPermissions.some(permission => hasPermission(req.user, permission))) {
    return next()
  }

  return deny(res)
}

const checkSelfOrPermission = (permission, getTargetId = req => req.params.id) => (req, res, next) => {
  const targetId = getTargetId(req)

  if (targetId && String(targetId) === String(req.user?.userId)) {
    return next()
  }

  if (hasPermission(req.user, permission)) {
    return next()
  }

  return deny(res)
}

module.exports = {
  checkPermission,
  checkAnyPermission,
  checkSelfOrPermission,
  hasPermission,
  isSuperAdmin
}









