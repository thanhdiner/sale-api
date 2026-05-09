const { issueTokensAndRespond } = require('../../../helpers/authHelper')
const logger = require('../../../../../config/logger')
const adminAuthService = require('../../../services/admin/access/auth.service')

const handleKnownAuthError = (res, error) => {
  if (!error?.statusCode) {
    return false
  }

  res.status(error.statusCode).json({ error: error.message })
  return true
}

//# POST /api/v1/admin/auth/login
module.exports.login = async (req, res) => {
  try {
    const result = await adminAuthService.loginAdmin(req.body)

    if (result.require2FA) {
      return res.status(200).json({ require2FA: true, userId: result.userId })
    }

    await issueTokensAndRespond(res, result.admin)
  } catch (error) {
    if (handleKnownAuthError(res, error)) return
    logger.error('[Admin] Login error:', error)
    res.status(500).json({ error: 'Đăng nhập thất bại, vui lòng thử lại sau!' })
  }
}

// # POST /api/v1/admin/auth/2fa-verify
module.exports.verify2FA = async (req, res) => {
  try {
    const result = await adminAuthService.verifyAdminLogin2FA(req.body)
    await issueTokensAndRespond(res, result.admin)
  } catch (err) {
    if (handleKnownAuthError(res, err)) return
    logger.error('[Admin] 2FA verify error:', err)
    res.status(500).json({ error: 'Xác thực 2FA thất bại' })
  }
}

//# POST /api/v1/admin/auth/refresh-token
module.exports.refreshToken = async (req, res) => {
  try {
    const data = await adminAuthService.refreshAdminAccessToken(req.cookies.refreshToken)
    res.json(data)
  } catch (error) {
    if (handleKnownAuthError(res, error)) return
    logger.error('[Admin] Refresh token error:', error)
    res.status(500).json({ error: 'Có lỗi xảy ra, vui lòng thử lại sau!' })
  }
}

//# POST /api/v1/admin/auth/logout
module.exports.logout = async (req, res) => {
  try {
    const result = await adminAuthService.logoutAdmin(req.cookies.refreshToken)

    if (result.clearedRefreshToken) {
      res.clearCookie('refreshToken', {
        httpOnly: true,
        sameSite: 'lax'
      })
    }

    res.sendStatus(204)
  } catch (error) {
    if (handleKnownAuthError(res, error)) return
    logger.error('[Admin] Logout error:', error)
    res.status(500).json({ error: 'Đăng xuất thất bại, vui lòng thử lại sau!' })
  }
}










