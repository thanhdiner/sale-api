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
module.exports.login = async (req, res, next) => {
  try {
    const result = await adminAuthService.loginAdmin(req.body)

    if (result.require2FA) {
      return res.status(200).json({ require2FA: true, userId: result.userId })
    }

    await issueTokensAndRespond(res, result.admin)
  } catch (error) {
    return next(error)
  }
}

// # POST /api/v1/admin/auth/2fa-verify
module.exports.verify2FA = async (req, res, next) => {
  try {
    const result = await adminAuthService.verifyAdminLogin2FA(req.body)
    await issueTokensAndRespond(res, result.admin)
  } catch (err) {
    return next(err)
  }
}

//# POST /api/v1/admin/auth/refresh-token
module.exports.refreshToken = async (req, res, next) => {
  try {
    const data = await adminAuthService.refreshAdminAccessToken(req.cookies.refreshToken)
    res.json(data)
  } catch (error) {
    return next(error)
  }
}

//# POST /api/v1/admin/auth/logout
module.exports.logout = async (req, res, next) => {
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
    return next(error)
  }
}










