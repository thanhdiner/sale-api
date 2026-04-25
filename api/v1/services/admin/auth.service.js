const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const speakeasy = require('speakeasy')
const adminAccountRepository = require('../../repositories/adminAccount.repository')
const refreshTokenRepository = require('../../repositories/refreshToken.repository')
const adminTrustedDeviceRepository = require('../../repositories/adminTrustedDevice.repository')
const AppError = require('../../utils/AppError')

const ACCESS_SECRET = process.env.ACCESS_SECRET
const REFRESH_SECRET = process.env.REFRESH_SECRET
const JWT_EXPIRES_IN_ACCESS = process.env.JWT_EXPIRES_IN_ACCESS || '1h'

async function findAdminWithRole(query) {
  return adminAccountRepository.findOne(query, {
    populate: {
      path: 'role_id',
      select: 'label permissions'
    }
  })
}

async function findAdminByIdWithRole(userId) {
  return adminAccountRepository.findById(userId, {
    populate: {
      path: 'role_id',
      select: 'label permissions'
    }
  })
}

async function loginAdmin({ username, password, deviceId }) {
  const admin = await findAdminWithRole({ username })

  if (!admin) {
    throw new AppError('Sai tài khoản hoặc mật khẩu', 401)
  }

  const validPassword = await bcrypt.compare(password, admin.passwordHash)

  if (!validPassword) {
    throw new AppError('Sai tài khoản hoặc mật khẩu', 401)
  }

  if (admin.twoFAEnabled) {
    if (deviceId) {
      const trustedDevice = await adminTrustedDeviceRepository.findOne({ userId: admin._id, deviceId })

      if (trustedDevice) {
        trustedDevice.lastUsed = new Date()
        trustedDevice.current = true
        await trustedDevice.save()

        admin.lastLogin = new Date()
        await admin.save()

        return { admin }
      }
    }

    return { require2FA: true, userId: admin._id }
  }

  admin.lastLogin = new Date()
  await admin.save()

  return { admin }
}

async function verifyAdminLogin2FA({ userId, code, type }) {
  const admin = await findAdminByIdWithRole(userId)

  if (!admin?.twoFAEnabled || !admin?.twoFASecret) {
    throw new AppError('Không hợp lệ', 400)
  }

  if (type === 'backup') {
    const normalizedCode = code.toUpperCase().replace(/\s/g, '')
    const backup = admin.backupCodes?.find(
      item => item.code?.toUpperCase().replace(/\s/g, '') === normalizedCode && !item.used
    )

    if (!backup) {
      throw new AppError('Mã dự phòng không đúng hoặc đã dùng!', 400)
    }

    backup.used = true
    await admin.save()

    admin.lastLogin = new Date()
    await admin.save()

    return { admin }
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

  admin.lastLogin = new Date()
  await admin.save()

  return { admin }
}

async function refreshAdminAccessToken(refreshToken) {
  if (!refreshToken) {
    throw new AppError('Không có refresh token', 401)
  }

  const dbToken = await refreshTokenRepository.findOne({ token: refreshToken })

  if (!dbToken) {
    throw new AppError('Refresh token không hợp lệ', 403)
  }

  if (dbToken.expiresAt < new Date()) {
    await refreshTokenRepository.deleteOne({ token: refreshToken })
    throw new AppError('Refresh token đã hết hạn', 403)
  }

  let decoded

  try {
    decoded = jwt.verify(refreshToken, REFRESH_SECRET)
  } catch {
    throw new AppError('Refresh token không hợp lệ hoặc đã hết hạn', 401)
  }

  const admin = await findAdminByIdWithRole(decoded.userId)

  if (!admin) {
    throw new AppError('Không tìm thấy tài khoản', 401)
  }

  const accessToken = jwt.sign(
    { userId: admin._id, username: admin.username, role: admin.role_id },
    ACCESS_SECRET,
    { expiresIn: JWT_EXPIRES_IN_ACCESS }
  )

  return { accessToken }
}

async function logoutAdmin(refreshToken) {
  if (refreshToken) {
    await refreshTokenRepository.deleteOne({ token: refreshToken })
  }

  return { clearedRefreshToken: !!refreshToken }
}

module.exports = {
  loginAdmin,
  verifyAdminLogin2FA,
  refreshAdminAccessToken,
  logoutAdmin
}
