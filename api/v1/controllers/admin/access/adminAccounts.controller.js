const logger = require('../../../../../config/logger')
const adminAccountsService = require('../../../services/admin/access/adminAccounts.service')

//# GET /api/v1/admin/accounts
module.exports.index = async (req, res, next) => {
  try {
    const accounts = await adminAccountsService.listAccounts()
    res.json({ data: accounts })
  } catch (err) {
    return next(err)
  }
}

//# POST /api/v1/admin/accounts/create
module.exports.create = async (req, res, next) => {
  try {
    const accountData = await adminAccountsService.createAccount(req.body)
    res.status(201).json({ data: accountData })
  } catch (err) {
    return next(err)
  }
}

//# PATCH /api/v1/admin/accounts/edit/:id
module.exports.edit = async (req, res, next) => {
  try {
    const updatedData = await adminAccountsService.editAccount(req.params.id, req.body)
    res.status(200).json({ message: 'Updated', data: updatedData })
  } catch (err) {
    return next(err)
  }
}

//# PATCH /api/v1/admin/permission-groups/delete/:id
module.exports.delete = async (req, res, next) => {
  try {
    await adminAccountsService.deleteAccount(req.params.id)
    res.status(200).json({ message: 'Account deleted successfully' })
  } catch (err) {
    return next(err)
  }
}

//# PATCH /api/v1/admin/accounts/change-status/:id
module.exports.changeStatus = async (req, res, next) => {
  try {
    const updatedData = await adminAccountsService.changeAccountStatus(req.params.id, req.body.status)
    res.status(200).json({ message: 'Cập nhật trạng thái thành công!', data: updatedData })
  } catch (err) {
    return next(err)
  }
}

//# PATCH /api/v1/admin/accounts/update-avatar/:id
module.exports.updateAvatar = async (req, res, next) => {
  try {
    const accountData = await adminAccountsService.updateAccountAvatar(req.params.id, req.body.avatarUrl)
    res.status(200).json({ message: 'Cập nhật ảnh đại diện thành công!', data: accountData })
  } catch (err) {
    return next(err)
  }
}

//# PATCH /api/v1/admin/accounts/update-profile/:id
module.exports.updateProfile = async (req, res, next) => {
  try {
    const data = await adminAccountsService.updateAccountProfile(req.params.id, req.body.fullName)
    res.status(200).json({ message: 'Cập nhật thành công!', data })
  } catch (err) {
    return next(err)
  }
}

//# PATCH /api/v1/admin/accounts/change-password
module.exports.changePassword = async (req, res, next) => {
  try {
    await adminAccountsService.changeAccountPassword(
      req.user.userId,
      req.body.currentPassword,
      req.body.newPassword
    )
    res.json({ message: 'Password changed successfully' })
  } catch (err) {
    return next(err)
  }
}

//# GET /api/v1/admin/accounts/2fa/status
module.exports.get2FAStatus = async (req, res, next) => {
  try {
    const data = await adminAccountsService.get2FAStatus(req.user.userId)
    res.json(data)
  } catch (err) {
    return next(err)
  }
}

//# POST /api/v1/admin/accounts/2fa/generate
module.exports.generate2FASecret = async (req, res, next) => {
  try {
    const data = await adminAccountsService.generate2FASecret(req.user.userId)
    res.json(data)
  } catch (err) {
    return next(err)
  }
}

//# POST /api/v1/admin/accounts/2fa/verify
module.exports.verify2FACode = async (req, res, next) => {
  try {
    const data = await adminAccountsService.verify2FACode(req.user.userId, req.body.code)
    res.json(data)
  } catch (err) {
    return next(err)
  }
}

//# POST /api/v1/admin/accounts/2fa/disable
module.exports.disable2FA = async (req, res, next) => {
  try {
    const data = await adminAccountsService.disable2FA(req.user.userId)
    res.json(data)
  } catch (err) {
    return next(err)
  }
}

//# POST /api/v1/admin/accounts/2fa/backup-codes
module.exports.regenerateBackupCodes = async (req, res, next) => {
  try {
    const data = await adminAccountsService.regenerateBackupCodes(req.user.userId)
    res.json(data)
  } catch (err) {
    return next(err)
  }
}

//# POST /api/v1/admin/accounts/trusted-devices
module.exports.trustDevice = async (req, res, next) => {
  try {
    const data = await adminAccountsService.trustDevice(req.user?.userId, req.body)
    res.json(data)
  } catch (err) {
    return next(err)
  }
}

//# GET /api/v1/admin/accounts/trusted-devices
module.exports.getTrustedDevices = async (req, res, next) => {
  try {
    const data = await adminAccountsService.getTrustedDevices(
      req.user.userId,
      req.cookies?.trustedDeviceId || null
    )
    res.json(data)
  } catch (err) {
    return next(err)
  }
}

//# DELETE /api/v1/admin/accounts/trusted-devices/:deviceId
module.exports.removeTrustedDevice = async (req, res, next) => {
  try {
    const data = await adminAccountsService.removeTrustedDevice(req.user.userId, req.params.deviceId)
    res.json(data)
  } catch (err) {
    return next(err)
  }
}










