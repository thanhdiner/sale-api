const jwt = require('jsonwebtoken')
const bcrypt = require('bcrypt')
const AdminAccount = require('../../models/adminAccount.model')
const RefreshToken = require('../../models/refreshToken.model')
const ms = require('ms')

const ACCESS_SECRET = process.env.ACCESS_SECRET
const REFRESH_SECRET = process.env.REFRESH_SECRET
const JWT_EXPIRES_IN_ACCESS = process.env.JWT_EXPIRES_IN_ACCESS || '1h'
const JWT_EXPIRES_IN_REFRESH = process.env.JWT_EXPIRES_IN_REFRESH || '30d'

//# POST /api/v1/admin/auth/login
module.exports.login = async (req, res) => {
  try {
    const { username, password } = req.body

    const admin = await AdminAccount.findOne({ username })
    if (!admin) return res.status(401).json({ error: 'Sai tài khoản hoặc mật khẩu' })

    const validPass = await bcrypt.compare(password, admin.passwordHash)
    if (!validPass) return res.status(401).json({ error: 'Sai tài khoản hoặc mật khẩu' })

    const accessToken = jwt.sign({ userId: admin._id, username: admin.username, role: admin.role_id }, ACCESS_SECRET, {
      expiresIn: JWT_EXPIRES_IN_ACCESS
    })

    const refreshToken = jwt.sign({ userId: admin._id }, REFRESH_SECRET, { expiresIn: JWT_EXPIRES_IN_REFRESH })

    await RefreshToken.create({
      userId: admin._id,
      token: refreshToken,
      expiresAt: new Date(Date.now() + ms(JWT_EXPIRES_IN_REFRESH))
    })

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/'
    })

    res.json({
      accessToken,
      user: {
        _id: admin._id,
        username: admin.username,
        email: admin.email,
        fullName: admin.fullName,
        role: admin.role_id,
        avatarUrl: admin.avatarUrl
      }
    })
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({ error: 'Đăng nhập thất bại, vui lòng thử lại sau!' })
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
      const admin = await AdminAccount.findById(decoded.userId)

      if (!admin) return res.status(401).json({ error: 'Không tìm thấy tài khoản' })

      const newAccessToken = jwt.sign({ userId: admin._id, username: admin.username, role: admin.role_id }, ACCESS_SECRET, {
        expiresIn: JWT_EXPIRES_IN_ACCESS
      })

      res.json({ accessToken: newAccessToken })
    } catch (error) {
      return res.status(401).json({ error: 'Refresh token không hợp lệ hoặc đã hết hạn' })
    }
  } catch (error) {
    console.error('Refresh token error:', error)
    res.status(500).json({ error: 'Có lỗi xảy ra, vui lòng thử lại sau!' })
  }
}

//# POST /api/v1/admin/auth/logout
module.exports.logout = async (req, res) => {
  try {
    const { refreshToken } = req.cookies
    if (refreshToken) {
      await RefreshToken.deleteOne({ token: refreshToken })
      res.clearCookie('refreshToken', { path: '/' })
    }
    res.sendStatus(204)
  } catch (error) {
    console.error('Logout error:', error)
    res.status(500).json({ error: 'Đăng xuất thất bại, vui lòng thử lại sau!' })
  }
}
