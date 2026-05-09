const logger = require('../../../../../config/logger')
const userService = require('../../../services/client/access/user.service')

function applyCookies(res, cookies = []) {
  cookies.forEach(({ name, value, options }) => {
    res.cookie(name, value, options)
  })
}

function clearResponseCookies(res, cookies = []) {
  cookies.forEach(({ name, options }) => {
    res.clearCookie(name, options)
  })
}

function sendServiceResult(res, result) {
  applyCookies(res, result.cookies)
  clearResponseCookies(res, result.clearCookies)

  if (result.body === null) {
    return res.sendStatus(result.statusCode)
  }

  return res.status(result.statusCode).json(result.body)
}

function handleUnexpectedError(res, message, err) {
  logger.error(message, err)
  return res.status(500).json({ error: err.message })
}

exports.login = async (req, res) => {
  try {
    const result = await userService.login(req.body)
    return sendServiceResult(res, result)
  } catch (err) {
    return handleUnexpectedError(res, '[Client][User] login error:', err)
  }
}

exports.register = async (req, res) => {
  try {
    const result = await userService.register(req.body)
    return sendServiceResult(res, result)
  } catch (err) {
    return handleUnexpectedError(res, '[Client][User] register error:', err)
  }
}

exports.refreshToken = async (req, res) => {
  try {
    const result = await userService.refreshToken(req.cookies.clientRefreshToken)
    return sendServiceResult(res, result)
  } catch (err) {
    return handleUnexpectedError(res, '[Client][User] refreshToken error:', err)
  }
}

exports.logout = async (req, res) => {
  try {
    const result = await userService.logout(req.cookies.clientRefreshToken)
    return sendServiceResult(res, result)
  } catch (err) {
    return handleUnexpectedError(res, '[Client][User] logout error:', err)
  }
}

exports.googleLoginCallback = async (req, res) => {
  try {
    const { redirectUrl } = await userService.createOauthCallback(req.user, 'Google')
    return res.redirect(redirectUrl)
  } catch (err) {
    return handleUnexpectedError(res, '[Client][User] googleLoginCallback error:', err)
  }
}

exports.facebookLoginCallback = async (req, res) => {
  try {
    const { redirectUrl } = await userService.createOauthCallback(req.user, 'Facebook')
    return res.redirect(redirectUrl)
  } catch (err) {
    return handleUnexpectedError(res, '[Client][User] facebookLoginCallback error:', err)
  }
}

exports.githubLoginCallback = async (req, res) => {
  try {
    const { redirectUrl } = await userService.createOauthCallback(req.user, 'GitHub')
    return res.redirect(redirectUrl)
  } catch (err) {
    return handleUnexpectedError(res, '[Client][User] githubLoginCallback error:', err)
  }
}

exports.oauthCodeLogin = async (req, res) => {
  try {
    const result = await userService.oauthCodeLogin(req.body.code)
    return sendServiceResult(res, result)
  } catch (err) {
    return handleUnexpectedError(res, '[Client][User] oauthCodeLogin error:', err)
  }
}

exports.getMe = async (req, res) => {
  try {
    const result = await userService.getMe(req.user.userId)
    return sendServiceResult(res, result)
  } catch (err) {
    return handleUnexpectedError(res, '[Client][User] getMe error:', err)
  }
}

exports.forgotPassword = async (req, res) => {
  try {
    const result = await userService.forgotPassword(req.body.email)
    return sendServiceResult(res, result)
  } catch (err) {
    return handleUnexpectedError(res, '[Client][User] forgotPassword error:', err)
  }
}

exports.verifyResetCode = async (req, res) => {
  try {
    const result = await userService.verifyResetCode(req.body)
    return sendServiceResult(res, result)
  } catch (err) {
    return handleUnexpectedError(res, '[Client][User] verifyResetCode error:', err)
  }
}

exports.resetPassword = async (req, res) => {
  try {
    const result = await userService.resetPassword(req.body)
    return sendServiceResult(res, result)
  } catch (err) {
    return handleUnexpectedError(res, '[Client][User] resetPassword error:', err)
  }
}

exports.updateProfile = async (req, res) => {
  try {
    const avatarUrl = req.body.avatarUrl || req.file?.path || ''
    const result = await userService.updateProfile(req.user.userId, {
      ...req.body,
      avatarUrl
    })
    return sendServiceResult(res, result)
  } catch (err) {
    return handleUnexpectedError(res, '[Client][User] updateProfile error:', err)
  }
}

exports.updateCheckoutProfile = async (req, res) => {
  try {
    const result = await userService.updateCheckoutProfile(req.user.userId, req.body)
    return sendServiceResult(res, result)
  } catch (err) {
    return handleUnexpectedError(res, '[Client][User] updateCheckoutProfile error:', err)
  }
}

exports.requestEmailUpdate = async (req, res) => {
  try {
    const result = await userService.requestEmailUpdate(req.user.userId, req.body.email)
    return sendServiceResult(res, result)
  } catch (err) {
    return handleUnexpectedError(res, '[Client][User] requestEmailUpdate error:', err)
  }
}

exports.confirmEmailUpdate = async (req, res) => {
  try {
    const result = await userService.confirmEmailUpdate(req.user.userId, req.body)
    return sendServiceResult(res, result)
  } catch (err) {
    return handleUnexpectedError(res, '[Client][User] confirmEmailUpdate error:', err)
  }
}

exports.changePassword = async (req, res) => {
  try {
    const result = await userService.changePassword(req.user.userId, req.body)
    return sendServiceResult(res, result)
  } catch (err) {
    return handleUnexpectedError(res, '[Client][User] changePassword error:', err)
  }
}










