const bcrypt = require('bcrypt')
const QRCode = require('qrcode')
const speakeasy = require('speakeasy')
const adminAccountRepository = require('../../../repositories/access/adminAccount.repository')
const adminTrustedDeviceRepository = require('../../../repositories/access/adminTrustedDevice.repository')
const AppError = require('../../../utils/AppError')
const generateBackupCodes = require('../../../utils/generateBackupCodes')

const ADMIN_ACCOUNT_ALLOWED_STATUSES = ['active', 'inactive', 'banned']

function normalizeAccountTranslations(translations = {}) {
  let parsedTranslations = translations

  if (typeof parsedTranslations === 'string') {
    try {
      parsedTranslations = JSON.parse(parsedTranslations)
    } catch {
      parsedTranslations = {}
    }
  }

  const englishFullName = parsedTranslations?.en?.fullName

  return {
    en: {
      fullName: typeof englishFullName === 'string' ? englishFullName.trim() : ''
    }
  }
}

const toPlainAdminAccount = admin => {
  const account = admin?.toObject ? admin.toObject() : { ...admin }
  delete account.passwordHash
  return account
}

const isProtectedAdminAccount = account =>
  String(account?.role_id) === 'superadmin' || account?.username === 'superadmin'

const getAdminAccountByIdOrThrow = async (id, message = 'Account not found') => {
  const account = await adminAccountRepository.findById(id)

  if (!account) {
    throw new AppError(message, 404)
  }

  return account
}

const getAdminByUserIdOrThrow = async (userId, message = 'Not found') => {
  const admin = await adminAccountRepository.findById(userId)

  if (!admin) {
    throw new AppError(message, 404)
  }

  return admin
}

async function listAccounts() {
  return adminAccountRepository.findByQuery(
    { deleted: false },
    { select: '-passwordHash' }
  )
}

async function createAccount(payload) {
  const { username, email, password, fullName, role_id, status, avatarUrl, translations } = payload

  const existingAccount = await adminAccountRepository.findOne({
    $or: [{ username }, { email }]
  })

  if (existingAccount) {
    throw new AppError('Username hoặc email đã tồn tại.', 400)
  }

  if (!username) throw new AppError('Username là bắt buộc!', 400)
  if (/\s/.test(username)) throw new AppError('Username không được chứa khoảng trắng!', 400)
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    throw new AppError('Username chỉ được chứa chữ cái, số và dấu _', 400)
  }
  if (!email) throw new AppError('Email là bắt buộc!', 400)
  if (!password) throw new AppError('Mật khẩu là bắt buộc!', 400)
  if (!fullName) throw new AppError('Tên đầy đủ là bắt buộc!', 400)

  const passwordHash = await bcrypt.hash(password, 10)
  const newAccount = await adminAccountRepository.create({
    username,
    email,
    fullName,
    translations: normalizeAccountTranslations(translations),
    role_id,
    status,
    avatarUrl,
    passwordHash
  })

  return toPlainAdminAccount(newAccount)
}

async function editAccount(id, payload) {
  const { email, fullName, role_id, status, avatarUrl, newPassword, translations } = payload

  if (!email) {
    throw new AppError('Email là bắt buộc!', 400)
  }

  const existingAccount = await adminAccountRepository.findOne({ _id: { $ne: id }, email })

  if (existingAccount) {
    throw new AppError('Email đã tồn tại.', 400)
  }

  const updateData = {
    email,
    fullName,
    translations: normalizeAccountTranslations(translations),
    role_id,
    status,
    avatarUrl
  }

  if (newPassword && newPassword.length >= 6) {
    updateData.passwordHash = await bcrypt.hash(newPassword, 10)
  }

  const updated = await adminAccountRepository.updateById(id, updateData)

  if (!updated) {
    throw new AppError('Account not found', 404)
  }

  return toPlainAdminAccount(updated)
}

async function deleteAccount(id) {
  const account = await getAdminAccountByIdOrThrow(id)

  if (isProtectedAdminAccount(account)) {
    throw new AppError('Không thể xoá tài khoản Super Admin!', 403)
  }

  await adminAccountRepository.updateById(id, {
    deleted: true,
    deletedAt: new Date()
  })
}

async function changeAccountStatus(id, status) {
  if (!ADMIN_ACCOUNT_ALLOWED_STATUSES.includes(status)) {
    throw new AppError('Trạng thái không hợp lệ!', 400)
  }

  const account = await getAdminAccountByIdOrThrow(id)

  if (isProtectedAdminAccount(account)) {
    throw new AppError('Không thể đổi trạng thái Super Admin!', 403)
  }

  const updated = await adminAccountRepository.updateById(id, { status })
  return toPlainAdminAccount(updated)
}

async function updateAccountAvatar(id, avatarUrl) {
  if (typeof avatarUrl !== 'string') {
    throw new AppError('Thiếu hoặc sai định dạng avatarUrl!', 400)
  }

  const account = await adminAccountRepository.updateById(id, { avatarUrl })

  if (!account) {
    throw new AppError('Không tìm thấy tài khoản!', 404)
  }

  return toPlainAdminAccount(account)
}

async function updateAccountProfile(id, fullName) {
  if (!fullName || fullName.trim() === '') {
    throw new AppError('Họ tên là bắt buộc!', 400)
  }

  const updated = await adminAccountRepository.updateById(
    id,
    { fullName: fullName.trim() },
    { populate: { path: 'role_id', select: 'label' } }
  )

  if (!updated) {
    throw new AppError('Không tìm thấy tài khoản!', 404)
  }

  return toPlainAdminAccount(updated)
}

async function changeAccountPassword(userId, currentPassword, newPassword) {
  if (!currentPassword || !newPassword) {
    throw new AppError('Missing current or new password', 400)
  }

  const admin = await getAdminByUserIdOrThrow(userId, 'Admin not found')
  const isMatch = await bcrypt.compare(currentPassword, admin.passwordHash)

  if (!isMatch) {
    throw new AppError('Current password is incorrect', 401)
  }

  admin.passwordHash = await bcrypt.hash(newPassword, 10)
  await admin.save()
}

async function get2FAStatus(userId) {
  const admin = await getAdminByUserIdOrThrow(userId)

  return {
    enabled: !!admin.twoFAEnabled,
    backupCodes: (admin.backupCodes || []).filter(code => !code.used).map(code => code.code)
  }
}

async function generate2FASecret(userId) {
  const admin = await getAdminByUserIdOrThrow(userId)
  const secret = speakeasy.generateSecret({
    name: `AdminPanel:${admin.username}`,
    issuer: 'AdminPanel'
  })

  admin.twoFASecret = secret.base32
  await admin.save()

  return {
    secret: secret.base32,
    qrUrl: await QRCode.toDataURL(secret.otpauth_url)
  }
}

async function verify2FACode(userId, code) {
  const admin = await getAdminByUserIdOrThrow(userId)

  if (!admin.twoFASecret) {
    throw new AppError('Chưa sinh mã 2FA', 400)
  }

  const verified = speakeasy.totp.verify({
    secret: admin.twoFASecret,
    encoding: 'base32',
    token: code,
    window: 1
  })

  if (!verified) {
    throw new AppError('Mã xác thực sai', 400)
  }

  admin.twoFAEnabled = true
  admin.backupCodes = await generateBackupCodes()
  await admin.save()

  return {
    success: true,
    backupCodes: admin.backupCodes.map(item => item.code)
  }
}

async function disable2FA(userId) {
  const admin = await getAdminByUserIdOrThrow(userId)

  admin.twoFAEnabled = false
  admin.twoFASecret = ''
  admin.backupCodes = []
  await admin.save()

  return { success: true }
}

async function regenerateBackupCodes(userId) {
  const admin = await getAdminByUserIdOrThrow(userId)

  if (!admin.twoFAEnabled) {
    throw new AppError('Chưa bật 2FA', 400)
  }

  admin.backupCodes = await generateBackupCodes()
  await admin.save()

  return { codes: admin.backupCodes.map(item => item.code) }
}

async function trustDevice(userId, payload) {
  const { deviceId, name, browser, location } = payload

  let device = await adminTrustedDeviceRepository.findOne({ userId, deviceId })

  if (!device) {
    device = await adminTrustedDeviceRepository.create({
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

  return { success: true, device }
}

async function getTrustedDevices(userId, currentDeviceId) {
  const devices = await adminTrustedDeviceRepository.findByQuery(
    { userId },
    { sort: { updatedAt: -1 } }
  )

  return {
    devices: devices.map(device => ({
      ...device.toObject(),
      current: device.deviceId === currentDeviceId
    }))
  }
}

async function removeTrustedDevice(userId, deviceId) {
  if (!deviceId) {
    throw new AppError('Thiếu deviceId trong URL', 400)
  }

  const deleted = await adminTrustedDeviceRepository.findOneAndDelete({ userId, deviceId })

  if (!deleted) {
    throw new AppError('Không tìm thấy thiết bị phù hợp', 404)
  }

  return { success: true, message: 'Xóa thiết bị thành công' }
}

module.exports = {
  listAccounts,
  createAccount,
  editAccount,
  deleteAccount,
  changeAccountStatus,
  updateAccountAvatar,
  updateAccountProfile,
  changeAccountPassword,
  get2FAStatus,
  generate2FASecret,
  verify2FACode,
  disable2FA,
  regenerateBackupCodes,
  trustDevice,
  getTrustedDevices,
  removeTrustedDevice
}












