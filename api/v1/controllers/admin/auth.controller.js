const jwt = require('jsonwebtoken')
const bcrypt = require('bcrypt')
const AdminAccount = require('../../models/adminAccount.model')
const RefreshToken = require('../../models/refreshToken.model')
const TrustedDevice = require('../../models/adminTrustedDevice.model')
const speakeasy = require('speakeasy')
const { issueTokensAndRespond } = require('../../helpers/authHelper')
const logger = require('../../../../config/logger')

const ACCESS_SECRET = process.env.ACCESS_SECRET
const REFRESH_SECRET = process.env.REFRESH_SECRET
const JWT_EXPIRES_IN_ACCESS = process.env.JWT_EXPIRES_IN_ACCESS || '1h'

//# POST /api/v1/admin/auth/login
module.exports.login = async (req, res) => {
  try {
    const { username, password, deviceId } = req.body

    const admin = await AdminAccount.findOne({ username }).populate({
      path: 'role_id',
      select: 'label permissions'
    })
    if (!admin) return res.status(401).json({ error: 'Sai tài khoản hoặc mật khẩu' })

    const validPass = await bcrypt.compare(password, admin.passwordHash)
    if (!validPass) return res.status(401).json({ error: 'Sai tài khoản hoặc mật khẩu' })

    if (admin.twoFAEnabled) {
      if (deviceId) {
        const trustedDevice = await TrustedDevice.findOne({ userId: admin._id, deviceId })
        if (trustedDevice) {
          trustedDevice.lastUsed = new Date()
          trustedDevice.current = true
          await trustedDevice.save()

          admin.lastLogin = new Date()
          await admin.save()

          return await issueTokensAndRespond(res, admin)
        }
      }
      return res.status(200).json({ require2FA: true, userId: admin._id })
    }
    admin.lastLogin = new Date()
    await admin.save()

    await issueTokensAndRespond(res, admin)
  } catch (error) {
    logger.error('[Admin] Login error:', error)
    res.status(500).json({ error: 'Đăng nhập thất bại, vui lòng thử lại sau!' })
  }
}

// # POST /api/v1/admin/auth/2fa-verify
module.exports.verify2FA = async (req, res) => {
  try {
    const { userId, code, deviceInfo, type } = req.body

    const admin = await AdminAccount.findById(userId).populate({
      path: 'role_id',
      select: 'label permissions'
    })
    if (!admin?.twoFAEnabled || !admin?.twoFASecret) return res.status(400).json({ error: 'Không hợp lệ' })

    if (type === 'backup') {
      const backup = admin.backupCodes?.find(
        b => b.code?.toUpperCase().replace(/\s/g, '') === code.toUpperCase().replace(/\s/g, '') && !b.used
      )
      if (!backup) return res.status(400).json({ error: 'Mã dự phòng không đúng hoặc đã dùng!' })

      backup.used = true
      await admin.save()

      admin.lastLogin = new Date()
      await admin.save()

      return await issueTokensAndRespond(res, admin)
    }

    const verified = speakeasy.totp.verify({
      secret: admin.twoFASecret,
      encoding: 'base32',
      token: code,
      window: 1
    })
    if (!verified) return res.status(400).json({ error: 'Mã xác thực sai' })

    admin.lastLogin = new Date()
    await admin.save()

    await issueTokensAndRespond(res, admin)
  } catch (err) {
    logger.error('[Admin] 2FA verify error:', err)
    res.status(500).json({ error: 'Xác thực 2FA thất bại' })
  }
}

//# POST /api/v1/admin/auth/refresh-token
module.exports.refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.cookies

    if (!refreshToken) return res.status(401).json({ error: 'Không có refresh token' })

    const dbToken = await RefreshToken.findOne({ token: refreshToken })
    if (!dbToken) return res.status(403).json({ error: 'Refresh token không hợp lệ' })

    if (dbToken.expiresAt < new Date()) {
      await RefreshToken.deleteOne({ token: refreshToken })
      return res.status(403).json({ error: 'Refresh token đã hết hạn' })
    }

    try {
      const decoded = jwt.verify(refreshToken, REFRESH_SECRET)
      const admin = await AdminAccount.findById(decoded.userId).populate({
        path: 'role_id',
        select: 'label permissions'
      })

      if (!admin) return res.status(401).json({ error: 'Không tìm thấy tài khoản' })

      const newAccessToken = jwt.sign({ userId: admin._id, username: admin.username, role: admin.role_id }, ACCESS_SECRET, {
        expiresIn: JWT_EXPIRES_IN_ACCESS
      })

      res.json({ accessToken: newAccessToken })
    } catch (error) {
      return res.status(401).json({ error: 'Refresh token không hợp lệ hoặc đã hết hạn' })
    }
  } catch (error) {
    logger.error('[Admin] Refresh token error:', error)
    res.status(500).json({ error: 'Có lỗi xảy ra, vui lòng thử lại sau!' })
  }
}

//# POST /api/v1/admin/auth/logout
module.exports.logout = async (req, res) => {
  try {
    const { refreshToken } = req.cookies
    if (refreshToken) {
      await RefreshToken.deleteOne({ token: refreshToken })
      res.clearCookie('refreshToken', {
        httpOnly: true,
        sameSite: 'lax'
      })
    }
    res.sendStatus(204)
  } catch (error) {
    logger.error('[Admin] Logout error:', error)
    res.status(500).json({ error: 'Đăng xuất thất bại, vui lòng thử lại sau!' })
  }
}
