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


exports.login = async (req, res, next) => {
  try {
    const result = await userService.login(req.body)
    return sendServiceResult(res, result)
  } catch (err) {
    return next(err)
  }
}

exports.register = async (req, res, next) => {
  try {
    const result = await userService.register(req.body)
    return sendServiceResult(res, result)
  } catch (err) {
    return next(err)
  }
}

exports.refreshToken = async (req, res, next) => {
  try {
    const result = await userService.refreshToken(req.cookies.clientRefreshToken)
    return sendServiceResult(res, result)
  } catch (err) {
    return next(err)
  }
}

exports.logout = async (req, res, next) => {
  try {
    const result = await userService.logout(req.cookies.clientRefreshToken)
    return sendServiceResult(res, result)
  } catch (err) {
    return next(err)
  }
}

exports.googleLoginCallback = async (req, res, next) => {
  try {
    const { redirectUrl } = await userService.createOauthCallback(req.user, 'Google')
    return res.redirect(redirectUrl)
  } catch (err) {
    return next(err)
  }
}

exports.facebookLoginCallback = async (req, res, next) => {
  try {
    const { redirectUrl } = await userService.createOauthCallback(req.user, 'Facebook')
    return res.redirect(redirectUrl)
  } catch (err) {
    return next(err)
  }
}

exports.githubLoginCallback = async (req, res, next) => {
  try {
    const { redirectUrl } = await userService.createOauthCallback(req.user, 'GitHub')
    return res.redirect(redirectUrl)
  } catch (err) {
    return next(err)
  }
}

exports.oauthCodeLogin = async (req, res, next) => {
  try {
    const result = await userService.oauthCodeLogin(req.body.code)
    return sendServiceResult(res, result)
  } catch (err) {
    return next(err)
  }
}

exports.getMe = async (req, res, next) => {
  try {
    const result = await userService.getMe(req.user.userId)
    return sendServiceResult(res, result)
  } catch (err) {
    return next(err)
  }
}

exports.forgotPassword = async (req, res, next) => {
  try {
    const result = await userService.forgotPassword(req.body.email)
    return sendServiceResult(res, result)
  } catch (err) {
    return next(err)
  }
}

exports.verifyResetCode = async (req, res, next) => {
  try {
    const result = await userService.verifyResetCode(req.body)
    return sendServiceResult(res, result)
  } catch (err) {
    return next(err)
  }
}

exports.resetPassword = async (req, res, next) => {
  try {
    const result = await userService.resetPassword(req.body)
    return sendServiceResult(res, result)
  } catch (err) {
    return next(err)
  }
}

exports.updateProfile = async (req, res, next) => {
  try {
    const avatarUrl = req.body.avatarUrl || req.file?.path || ''
    const result = await userService.updateProfile(req.user.userId, {
      ...req.body,
      avatarUrl
    })
    return sendServiceResult(res, result)
  } catch (err) {
    return next(err)
  }
}

exports.updateCheckoutProfile = async (req, res, next) => {
  try {
    const result = await userService.updateCheckoutProfile(req.user.userId, req.body)
    return sendServiceResult(res, result)
  } catch (err) {
    return next(err)
  }
}

exports.getNotificationPreferences = async (req, res, next) => {
  try {
    const result = await userService.getNotificationPreferences(req.user.userId)
    return sendServiceResult(res, result)
  } catch (err) {
    return next(err)
  }
}

exports.updateNotificationPreferences = async (req, res, next) => {
  try {
    const result = await userService.updateNotificationPreferences(req.user.userId, req.body)
    return sendServiceResult(res, result)
  } catch (err) {
    return next(err)
  }
}

exports.requestEmailUpdate = async (req, res, next) => {
  try {
    const result = await userService.requestEmailUpdate(req.user.userId, req.body.email)
    return sendServiceResult(res, result)
  } catch (err) {
    return next(err)
  }
}

exports.confirmEmailUpdate = async (req, res, next) => {
  try {
    const result = await userService.confirmEmailUpdate(req.user.userId, req.body)
    return sendServiceResult(res, result)
  } catch (err) {
    return next(err)
  }
}

exports.changePassword = async (req, res, next) => {
  try {
    const result = await userService.changePassword(req.user.userId, req.body)
    return sendServiceResult(res, result)
  } catch (err) {
    return next(err)
  }
}










