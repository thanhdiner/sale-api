const logger = require('../../../../../config/logger')
const adminAccountsService = require('../../../services/admin/access/adminAccounts.service')

const handleKnownControllerError = (res, error) => {
  if (!error?.statusCode) {
    return false
  }

  if (error.details) {
    res.status(error.statusCode).json({ message: error.message, details: error.details })
  } else {
    res.status(error.statusCode).json({ message: error.message })
  }

  return true
}

//# GET /api/v1/admin/accounts
module.exports.index = async (req, res) => {
  try {
    const accounts = await adminAccountsService.listAccounts()
    res.json({ data: accounts })
  } catch (err) {
    logger.error('[Admin] Error getting accounts:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

//# POST /api/v1/admin/accounts/create
module.exports.create = async (req, res) => {
  try {
    const accountData = await adminAccountsService.createAccount(req.body)
    res.status(201).json({ data: accountData })
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error('[Admin] Error creating account:', err)
    res.status(500).json({ error: 'Internal server error', message: 'Created unsuccessful', status: 500 })
  }
}

//# PATCH /api/v1/admin/accounts/edit/:id
module.exports.edit = async (req, res) => {
  try {
    const updatedData = await adminAccountsService.editAccount(req.params.id, req.body)
    res.status(200).json({ message: 'Updated', data: updatedData })
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    res.status(500).json({ error: 'Internal server error', message: 'Updated unsuccessful', status: 500 })
  }
}

//# PATCH /api/v1/admin/permission-groups/delete/:id
module.exports.delete = async (req, res) => {
  try {
    await adminAccountsService.deleteAccount(req.params.id)
    res.status(200).json({ message: 'Account deleted successfully' })
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    res.status(500).json({ error: 'Internal server error', status: 500 })
  }
}

//# PATCH /api/v1/admin/accounts/change-status/:id
module.exports.changeStatus = async (req, res) => {
  try {
    const updatedData = await adminAccountsService.changeAccountStatus(req.params.id, req.body.status)
    res.status(200).json({ message: 'Cập nhật trạng thái thành công!', data: updatedData })
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    res.status(500).json({ error: 'Internal server error', message: 'Updated unsuccessful', status: 500 })
  }
}

//# PATCH /api/v1/admin/accounts/update-avatar/:id
module.exports.updateAvatar = async (req, res) => {
  try {
    const accountData = await adminAccountsService.updateAccountAvatar(req.params.id, req.body.avatarUrl)
    res.status(200).json({ message: 'Cập nhật ảnh đại diện thành công!', data: accountData })
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error('[Admin] Error updating avatar:', err)
    res.status(500).json({ message: 'Lỗi máy chủ khi cập nhật avatar.' })
  }
}

//# PATCH /api/v1/admin/accounts/update-profile/:id
module.exports.updateProfile = async (req, res) => {
  try {
    const data = await adminAccountsService.updateAccountProfile(req.params.id, req.body.fullName)
    res.status(200).json({ message: 'Cập nhật thành công!', data })
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error('[Admin] Error updating profile:', err)
    res.status(500).json({ message: 'Lỗi máy chủ khi cập nhật profile!' })
  }
}

//# PATCH /api/v1/admin/accounts/change-password
module.exports.changePassword = async (req, res) => {
  try {
    await adminAccountsService.changeAccountPassword(
      req.user.userId,
      req.body.currentPassword,
      req.body.newPassword
    )
    res.json({ message: 'Password changed successfully' })
  } catch (err) {
    if (err?.statusCode) {
      return res.status(err.statusCode).json({ error: err.message, message: err.message })
    }
    logger.error('[Admin] Error changing password:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

//# GET /api/v1/admin/accounts/2fa/status
module.exports.get2FAStatus = async (req, res) => {
  try {
    const data = await adminAccountsService.get2FAStatus(req.user.userId)
    res.json(data)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    res.status(500).json({ message: 'Internal server error' })
  }
}

//# POST /api/v1/admin/accounts/2fa/generate
module.exports.generate2FASecret = async (req, res) => {
  try {
    const data = await adminAccountsService.generate2FASecret(req.user.userId)
    res.json(data)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    res.status(500).json({ message: 'Internal server error' })
  }
}

//# POST /api/v1/admin/accounts/2fa/verify
module.exports.verify2FACode = async (req, res) => {
  try {
    const data = await adminAccountsService.verify2FACode(req.user.userId, req.body.code)
    res.json(data)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    res.status(500).json({ message: 'Internal server error' })
  }
}

//# POST /api/v1/admin/accounts/2fa/disable
module.exports.disable2FA = async (req, res) => {
  try {
    const data = await adminAccountsService.disable2FA(req.user.userId)
    res.json(data)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    res.status(500).json({ message: 'Internal server error' })
  }
}

//# POST /api/v1/admin/accounts/2fa/backup-codes
module.exports.regenerateBackupCodes = async (req, res) => {
  try {
    const data = await adminAccountsService.regenerateBackupCodes(req.user.userId)
    res.json(data)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    res.status(500).json({ message: 'Internal server error' })
  }
}

//# POST /api/v1/admin/accounts/trusted-devices
module.exports.trustDevice = async (req, res) => {
  try {
    const data = await adminAccountsService.trustDevice(req.user?.userId, req.body)
    res.json(data)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    res.status(500).json({ error: 'Lưu thiết bị tin cậy thất bại!' })
  }
}

//# GET /api/v1/admin/accounts/trusted-devices
module.exports.getTrustedDevices = async (req, res) => {
  try {
    const data = await adminAccountsService.getTrustedDevices(
      req.user.userId,
      req.cookies?.trustedDeviceId || null
    )
    res.json(data)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error('[Admin] Error getting trusted devices:', err)
    res.status(500).json({ error: 'Không lấy được thiết bị tin cậy' })
  }
}

//# DELETE /api/v1/admin/accounts/trusted-devices/:deviceId
module.exports.removeTrustedDevice = async (req, res) => {
  try {
    const data = await adminAccountsService.removeTrustedDevice(req.user.userId, req.params.deviceId)
    res.json(data)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error('[Admin] Error removing trusted device:', err)
    res.status(500).json({ message: 'Lỗi máy chủ khi xoá thiết bị' })
  }
}










