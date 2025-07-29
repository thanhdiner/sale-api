module.exports.checkPermission = permission => (req, res, next) => {
  const permissions = req.user?.role?.permissions || []
  if (!permissions.includes(permission)) return res.status(403).json({ error: 'Bạn không có quyền thực hiện thao tác này' })
  next()
}
