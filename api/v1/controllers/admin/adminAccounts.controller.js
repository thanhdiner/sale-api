const AdminAccount = require('../../models/adminAccount.model')
const bcrypt = require('bcrypt')
const generateBackupCodes = require('../../utils/generateBackupCodes')
const speakeasy = require('speakeasy')
const QRCode = require('qrcode')
const TrustedDevice = require('../../models/adminTrustedDevice.model')

//# GET /api/v1/admin/accounts
module.exports.index = async (req, res) => {
  try {
    const find = { deleted: false }
    const accounts = await AdminAccount.find(find).select('-passwordHash')
    res.json({ data: accounts })
  } catch (err) {
    console.error('Error getting accounts:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

//# POST /api/v1/admin/accounts/create
module.exports.create = async (req, res) => {
  try {
    const { username, email, password, fullName, role_id, status, avatarUrl } = req.body
    const exist = await AdminAccount.findOne({
      $or: [{ username }, { email }]
    })
    if (exist) return res.status(400).json({ message: 'Username hoặc email đã tồn tại.' })
    if (!username) return res.status(400).json({ message: 'Username là bắt buộc!' })
    if (/\s/.test(username)) return res.status(400).json({ message: 'Username không được chứa khoảng trắng!' })
    if (!/^[a-zA-Z0-9_]+$/.test(username)) return res.status(400).json({ message: 'Username chỉ được chứa chữ cái, số và dấu _' })
    if (!email) return res.status(400).json({ message: 'Email là bắt buộc!' })
    if (!password) return res.status(400).json({ message: 'Mật khẩu là bắt buộc!' })
    if (!fullName) return res.status(400).json({ message: 'Tên đầy đủ là bắt buộc!' })
    const passwordHash = await bcrypt.hash(password, 10)

    const newAccount = new AdminAccount({
      username,
      email,
      fullName,
      role_id,
      status,
      avatarUrl,
      passwordHash
    })
    await newAccount.save()
    const { passwordHash: _, ...accountData } = newAccount.toObject()

    res.status(201).json({ data: accountData })
  } catch (err) {
    console.error('Error creating account:', err)
    return res.status(500).json({ error: 'Internal server error', message: 'Created unsuccessful', status: 500 })
  }
}

//# PATCH /api/v1/admin/accounts/edit/:id
module.exports.edit = async (req, res) => {
  try {
    const { id } = req.params
    const { email, fullName, role_id, status, avatarUrl, newPassword } = req.body

    if (!email) return res.status(400).json({ message: 'Email là bắt buộc!' })

    const exist = await AdminAccount.findOne({ _id: { $ne: id }, email })
    if (exist) return res.status(400).json({ message: 'Email đã tồn tại.' })

    const updateData = { email, fullName, role_id, status, avatarUrl }

    if (newPassword && newPassword.length >= 6) {
      const passwordHash = await bcrypt.hash(newPassword, 10)
      updateData.passwordHash = passwordHash
    }

    const updated = await AdminAccount.findByIdAndUpdate(id, updateData, { new: true })
    if (!updated) return res.status(404).json({ error: 'Account not found' })

    const { passwordHash: _, ...updatedData } = updated.toObject()

    res.status(200).json({ message: 'Updated', data: updatedData })
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error', message: 'Updated unsuccessful', status: 500 })
  }
}

//# PATCH /api/v1/admin/permission-groups/delete/:id
module.exports.delete = async (req, res) => {
  try {
    const { id } = req.params

    const account = await AdminAccount.findById(id)
    if (!account) return res.status(404).json({ message: 'Account not found' })

    if (account.role_id === 'superadmin' || account.username === 'superadmin')
      return res.status(403).json({ message: 'Không thể xoá tài khoản Super Admin!' })

    await AdminAccount.findByIdAndUpdate(id, { deleted: true }, { new: true })

    res.status(200).json({ message: 'Account deleted successfully' })
  } catch (err) {
    res.status(500).json({ error: 'Internal server error', status: 500 })
  }
}

//# PATCH /api/v1/admin/accounts/change-status/:id
module.exports.changeStatus = async (req, res) => {
  try {
    const { id } = req.params
    const { status } = req.body

    if (!['active', 'inactive', 'banned'].includes(status)) return res.status(400).json({ message: 'Trạng thái không hợp lệ!' })
    const account = await AdminAccount.findById(id)
    if (!account) return res.status(404).json({ message: 'Account not found' })
    if (account.role_id === 'superadmin' || account.username === 'superadmin')
      return res.status(403).json({ message: 'Không thể đổi trạng thái Super Admin!' })
    const updated = await AdminAccount.findByIdAndUpdate(id, { status }, { new: true })
    const { passwordHash: _, ...updatedData } = updated.toObject()
    res.status(200).json({ message: 'Cập nhật trạng thái thành công!', data: updatedData })
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error', message: 'Updated unsuccessful', status: 500 })
  }
}

//# PATCH /api/v1/admin/accounts/update-avatar/:id
module.exports.updateAvatar = async (req, res) => {
  try {
    const { id } = req.params
    const { avatarUrl } = req.body

    if (typeof avatarUrl !== 'string') {
      return res.status(400).json({ message: 'Thiếu hoặc sai định dạng avatarUrl!' })
    }

    const account = await AdminAccount.findByIdAndUpdate(id, { avatarUrl }, { new: true })
    if (!account) return res.status(404).json({ message: 'Không tìm thấy tài khoản!' })

    const { passwordHash, ...accountData } = account.toObject()
    res.status(200).json({ message: 'Cập nhật ảnh đại diện thành công!', data: accountData })
  } catch (err) {
    console.error('Lỗi cập nhật avatar:', err)
    res.status(500).json({ message: 'Lỗi máy chủ khi cập nhật avatar.' })
  }
}

//# PATCH /api/v1/admin/accounts/update-profile/:id
module.exports.updateProfile = async (req, res) => {
  try {
    const { id } = req.params
    const { fullName } = req.body

    if (!fullName || fullName.trim() === '') return res.status(400).json({ message: 'Họ tên là bắt buộc!' })

    const updated = await AdminAccount.findByIdAndUpdate(id, { fullName: fullName.trim() }, { new: true }).populate('role_id', 'label')
    if (!updated) return res.status(404).json({ message: 'Không tìm thấy tài khoản!' })

    const { passwordHash, ...data } = updated.toObject()

    res.status(200).json({ message: 'Cập nhật thành công!', data })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Lỗi máy chủ khi cập nhật profile!' })
  }
}

//# PATCH /api/v1/admin/accounts/change-password
module.exports.changePassword = async (req, res) => {
  try {
    const id = req.user.userId
    const { currentPassword, newPassword } = req.body

    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Missing current or new password' })

    const admin = await AdminAccount.findById(id)
    if (!admin) return res.status(404).json({ error: 'Admin not found', message: 'Admin not found' })

    const isMatch = await bcrypt.compare(currentPassword, admin.passwordHash)
    if (!isMatch) return res.status(401).json({ error: 'Current password is incorrect', message: 'Current password is incorrect' })

    const hashedNewPassword = await bcrypt.hash(newPassword, 10)
    admin.passwordHash = hashedNewPassword
    await admin.save()

    res.json({ message: 'Password changed successfully' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
}

//# GET /api/v1/admin/accounts/2fa/status
module.exports.get2FAStatus = async (req, res) => {
  try {
    const admin = await AdminAccount.findById(req.user.userId)
    if (!admin) return res.status(404).json({ message: 'Not found' })
    res.json({
      enabled: !!admin.twoFAEnabled,
      backupCodes: (admin.backupCodes || []).filter(c => !c.used).map(c => c.code)
    })
  } catch (err) {
    res.status(500).json({ message: 'Internal server error' })
  }
}

//# POST /api/v1/admin/accounts/2fa/generate
module.exports.generate2FASecret = async (req, res) => {
  try {
    const admin = await AdminAccount.findById(req.user.userId)
    if (!admin) return res.status(404).json({ message: 'Not found' })
    const secret = speakeasy.generateSecret({
      name: `AdminPanel:${admin.username}`,
      issuer: 'AdminPanel'
    })
    admin.twoFASecret = secret.base32
    await admin.save()
    const qrUrl = await QRCode.toDataURL(secret.otpauth_url)
    res.json({ secret: secret.base32, qrUrl })
  } catch (err) {
    res.status(500).json({ message: 'Internal server error' })
  }
}

//# POST /api/v1/admin/accounts/2fa/verify
module.exports.verify2FACode = async (req, res) => {
  try {
    const { code } = req.body
    const admin = await AdminAccount.findById(req.user.userId)
    if (!admin?.twoFASecret) return res.status(400).json({ message: 'Chưa sinh mã 2FA' })
    const verified = speakeasy.totp.verify({
      secret: admin.twoFASecret,
      encoding: 'base32',
      token: code,
      window: 1
    })
    if (!verified) return res.status(400).json({ message: 'Mã xác thực sai' })
    admin.twoFAEnabled = true
    admin.backupCodes = await generateBackupCodes()
    await admin.save()
    res.json({ success: true, backupCodes: admin.backupCodes.map(c => c.code) })
  } catch (err) {
    res.status(500).json({ message: 'Internal server error' })
  }
}

//# POST /api/v1/admin/accounts/2fa/disable
module.exports.disable2FA = async (req, res) => {
  try {
    const admin = await AdminAccount.findById(req.user.userId)
    if (!admin) return res.status(404).json({ message: 'Not found' })
    admin.twoFAEnabled = false
    admin.twoFASecret = ''
    admin.backupCodes = []
    await admin.save()
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ message: 'Internal server error' })
  }
}

//# POST /api/v1/admin/accounts/2fa/backup-codes
module.exports.regenerateBackupCodes = async (req, res) => {
  try {
    const admin = await AdminAccount.findById(req.user.userId)
    if (!admin?.twoFAEnabled) return res.status(400).json({ message: 'Chưa bật 2FA' })
    admin.backupCodes = await generateBackupCodes()
    await admin.save()
    res.json({ codes: admin.backupCodes.map(c => c.code) })
  } catch (err) {
    res.status(500).json({ message: 'Internal server error' })
  }
}

//# POST /api/v1/admin/accounts/trusted-devices
module.exports.trustDevice = async (req, res) => {
  try {
    const { deviceId, name, browser, location } = req.body
    const userId = req.user?.userId

    let device = await TrustedDevice.findOne({ userId, deviceId })
    if (!device) {
      device = await TrustedDevice.create({
        userId,
        deviceId,
        name,
        browser,
        location,
        lastUsed: new Date(),
        current: true
      })
    } else {
      device.lastUsed = new Date()
      device.current = true
      await device.save()
    }

    res.json({ success: true, device })
  } catch (err) {
    res.status(500).json({ error: 'Lưu thiết bị tin cậy thất bại!' })
  }
}

//# GET /api/v1/admin/accounts/trusted-devices
module.exports.getTrustedDevices = async (req, res) => {
  try {
    const userId = req.user.userId
    const currentDeviceId = req.cookies?.trustedDeviceId || null

    const devices = await TrustedDevice.find({ userId }).sort({ updatedAt: -1 })

    const devicesWithCurrent = devices.map(device => {
      const isCurrent = device.deviceId === currentDeviceId
      return {
        ...device.toObject(),
        current: isCurrent
      }
    })

    res.json({ devices: devicesWithCurrent })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Không lấy được thiết bị tin cậy' })
  }
}

//# DELETE /api/v1/admin/accounts/trusted-devices/:deviceId
module.exports.removeTrustedDevice = async (req, res) => {
  try {
    const userId = req.user.userId
    const { deviceId } = req.params

    if (!deviceId) {
      return res.status(400).json({ message: 'Thiếu deviceId trong URL' })
    }

    const deleted = await TrustedDevice.findOneAndDelete({ userId, deviceId })

    if (!deleted) {
      return res.status(404).json({ message: 'Không tìm thấy thiết bị phù hợp' })
    }

    res.json({ success: true, message: 'Xóa thiết bị thành công' })
  } catch (err) {
    console.error('Lỗi khi xoá thiết bị:', err)
    res.status(500).json({ message: 'Lỗi máy chủ khi xoá thiết bị' })
  }
}
