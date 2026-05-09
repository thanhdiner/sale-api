const jwt = require('jsonwebtoken')
const ms = require('ms')
const { v4: uuidv4 } = require('uuid')
const sendMail = require('../../../utils/sendMail')
const { getVerifyCodeHtml } = require('../../../utils/emailTemplates')
const { normalizeStructuredAddress } = require('../../../utils/structuredAddress')
const logger = require('../../../../../config/logger')
const userRepository = require('../../../repositories/access/user.repository')
const resetCodeRepository = require('../../../repositories/access/resetCode.repository')
const emailUpdateCodeRepository = require('../../../repositories/access/emailUpdateCode.repository')
const clientRefreshTokenRepository = require('../../../repositories/access/clientRefreshToken.repository')
const oauthCodeRepository = require('../../../repositories/access/oauthCode.repository')

const ACCESS_SECRET = process.env.ACCESS_SECRET
const REFRESH_SECRET = process.env.REFRESH_SECRET
const JWT_EXPIRES_IN_ACCESS = process.env.JWT_EXPIRES_IN_ACCESS || '1h'
const JWT_EXPIRES_IN_REFRESH = process.env.JWT_EXPIRES_IN_REFRESH || '30d'

const normalizeStringField = value => (typeof value === 'string' ? value.trim() : '')

const normalizeCheckoutProfile = payload => {
  const normalizedAddress = normalizeStructuredAddress(payload)

  return {
    firstName: normalizeStringField(payload?.firstName),
    lastName: normalizeStringField(payload?.lastName),
    phone: normalizeStringField(payload?.phone),
    email: normalizeStringField(payload?.email),
    ...normalizedAddress,
    notes: normalizeStringField(payload?.notes),
    deliveryMethod: payload?.deliveryMethod === 'contact' ? 'contact' : 'pickup',
    paymentMethod: ['transfer', 'contact', 'vnpay', 'momo', 'zalopay', 'sepay'].includes(payload?.paymentMethod)
      ? payload.paymentMethod
      : 'transfer'
  }
}

const normalizeNotificationPreferences = payload => ({
  channels: {
    inApp: payload?.channels?.inApp !== false,
    email: payload?.channels?.email !== false,
    browser: payload?.channels?.browser !== false,
    sms: payload?.channels?.sms === true
  },
  orderUpdates: payload?.orderUpdates !== false,
  paymentUpdates: payload?.paymentUpdates !== false,
  promotions: payload?.promotions !== false,
  backInStock: payload?.backInStock !== false,
  wishlistUpdates: payload?.wishlistUpdates !== false,
  supportMessages: payload?.supportMessages !== false
})

const serializeAuthUser = user => ({
  _id: user._id,
  username: user.username,
  email: user.email,
  fullName: user.fullName,
  phone: user.phone || '',
  avatarUrl: user.avatarUrl || '',
  lastLogin: user.lastLogin || null,
  checkoutProfile: normalizeCheckoutProfile(user.checkoutProfile || {}),
  notificationPreferences: normalizeNotificationPreferences(user.notificationPreferences || {})
})

function buildCookieOptions(remember) {
  const cookieOptions = {
    httpOnly: true,
    sameSite: 'lax'
  }

  if (remember) {
    cookieOptions.maxAge = ms(JWT_EXPIRES_IN_REFRESH)
  }

  return cookieOptions
}

async function issueClientTokens(user, remember = false) {
  const clientAccessToken = jwt.sign(
    { userId: user._id, username: user.username },
    ACCESS_SECRET,
    { expiresIn: JWT_EXPIRES_IN_ACCESS }
  )

  const refreshToken = jwt.sign(
    { userId: user._id, username: user.username },
    REFRESH_SECRET,
    { expiresIn: JWT_EXPIRES_IN_REFRESH }
  )

  const refreshExpiresAt = new Date(Date.now() + ms(JWT_EXPIRES_IN_REFRESH))

  await clientRefreshTokenRepository.deleteMany({ userId: user._id })
  await clientRefreshTokenRepository.create({
    userId: user._id,
    token: refreshToken,
    expiresAt: refreshExpiresAt
  })

  return {
    clientAccessToken,
    refreshToken,
    cookieOptions: buildCookieOptions(remember)
  }
}

async function login({ identity, password, remember }) {
  const user = await userRepository.findOne({
    $or: [{ username: identity }, { email: identity }]
  })

  if (!user || !(await user.comparePassword(password))) {
    return { statusCode: 401, body: { error: 'Tài khoản hoặc mật khẩu không đúng!' } }
  }

  user.lastLogin = new Date()
  await user.save()

  const tokens = await issueClientTokens(user, remember)

  return {
    statusCode: 200,
    body: {
      message: 'Đăng nhập thành công!',
      clientAccessToken: tokens.clientAccessToken,
      user: serializeAuthUser(user)
    },
    cookies: [
      {
        name: 'clientRefreshToken',
        value: tokens.refreshToken,
        options: tokens.cookieOptions
      }
    ]
  }
}

async function register(payload) {
  const { username, email, password, fullName, phone } = payload

  const existingUser = await userRepository.findOne({
    $or: [{ username }, { email }]
  })

  if (existingUser) {
    return { statusCode: 400, body: { error: 'Username hoặc email đã được sử dụng!' } }
  }

  await userRepository.create({
    username,
    email,
    phone,
    passwordHash: password,
    fullName
  })

  return {
    statusCode: 201,
    body: { message: 'Đăng ký thành công! Vui lòng đăng nhập.' }
  }
}

async function refreshToken(clientRefreshToken) {
  if (!clientRefreshToken) {
    return { statusCode: 401, body: { error: 'Không có refresh token' } }
  }

  const dbToken = await clientRefreshTokenRepository.findOne({ token: clientRefreshToken })
  if (!dbToken) {
    return { statusCode: 403, body: { error: 'Refresh token không hợp lệ' } }
  }

  if (dbToken.expiresAt < new Date()) {
    await clientRefreshTokenRepository.deleteOne({ token: clientRefreshToken })
    return { statusCode: 403, body: { error: 'Refresh token đã hết hạn' } }
  }

  let decoded
  try {
    decoded = jwt.verify(clientRefreshToken, REFRESH_SECRET)
  } catch {
    return { statusCode: 401, body: { error: 'Refresh token không hợp lệ hoặc đã hết hạn' } }
  }

  const user = await userRepository.findById(decoded.userId)
  if (!user) {
    return { statusCode: 401, body: { error: 'Không tìm thấy tài khoản' } }
  }

  const newAccessToken = jwt.sign(
    { userId: user._id, username: user.username },
    ACCESS_SECRET,
    { expiresIn: JWT_EXPIRES_IN_ACCESS }
  )

  return {
    statusCode: 200,
    body: {
      clientAccessToken: newAccessToken,
      user: serializeAuthUser(user)
    }
  }
}

async function logout(clientRefreshToken) {
  const clearCookies = []

  if (clientRefreshToken) {
    await clientRefreshTokenRepository.deleteOne({ token: clientRefreshToken })
    clearCookies.push({
      name: 'clientRefreshToken',
      options: { httpOnly: true, sameSite: 'lax' }
    })
  }

  return {
    statusCode: 204,
    body: null,
    clearCookies
  }
}

async function createOauthCallback(user, providerLabel) {
  const code = uuidv4()
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000)

  await oauthCodeRepository.create({
    code,
    userId: user._id,
    expiresAt
  })

  return {
    redirectUrl: `${process.env.CLIENT_URL}/user/oauth-callback?code=${code}`,
    providerLabel
  }
}

async function oauthCodeLogin(code) {
  if (!code) {
    return { statusCode: 400, body: { error: 'Thiếu mã code' } }
  }

  const oauthCode = await oauthCodeRepository.findOne({ code, used: false })
  if (!oauthCode) {
    return { statusCode: 400, body: { error: 'Mã code không hợp lệ hoặc đã sử dụng' } }
  }
  if (oauthCode.expiresAt < new Date()) {
    return { statusCode: 400, body: { error: 'Mã code đã hết hạn' } }
  }

  const user = await userRepository.findById(oauthCode.userId)
  if (!user) {
    return { statusCode: 404, body: { error: 'User không tồn tại' } }
  }

  user.lastLogin = new Date()
  await user.save()

  const tokens = await issueClientTokens(user)
  oauthCode.used = true
  await oauthCode.save()

  return {
    statusCode: 200,
    body: {
      clientAccessToken: tokens.clientAccessToken,
      user: serializeAuthUser(user)
    },
    cookies: [
      {
        name: 'clientRefreshToken',
        value: tokens.refreshToken,
        options: { httpOnly: true, sameSite: 'lax' }
      }
    ]
  }
}

async function getMe(userId) {
  const user = await userRepository.findById(userId, { select: '-__v' })
  if (!user) {
    return { statusCode: 404, body: { error: 'User not found' } }
  }

  const userObj = user.toObject()
  delete userObj.passwordHash

  return { statusCode: 200, body: userObj }
}

async function forgotPassword(email) {
  if (!email) {
    return { statusCode: 400, body: { message: 'Email là bắt buộc!' } }
  }

  const user = await userRepository.findOne({ email })
  if (!user) {
    return { statusCode: 404, body: { message: 'Không tìm thấy user với email này!' } }
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString()
  const expiresAt = new Date(Date.now() + 3 * 60 * 1000)

  await resetCodeRepository.deleteMany({ email })
  await resetCodeRepository.create({ email, code, expiresAt })

  try {
    await sendMail(
      email,
      'Mã xác thực đặt lại mật khẩu',
      `Mã xác thực của bạn là: ${code}`,
      getVerifyCodeHtml('Mã xác thực đặt lại mật khẩu', code)
    )
  } catch (err) {
    return { statusCode: 500, body: { message: 'Lỗi gửi mail! ' + err.message } }
  }

  return { statusCode: 200, body: { message: 'Đã gửi mã xác thực tới email!' } }
}

async function verifyResetCode({ email, code }) {
  if (!email || !code) {
    return { statusCode: 400, body: { message: 'Thiếu email hoặc mã xác thực!' } }
  }

  const resetCode = await resetCodeRepository.findOne({ email, code, used: false })
  if (!resetCode) {
    return { statusCode: 400, body: { message: 'Mã xác thực không hợp lệ!' } }
  }
  if (resetCode.expiresAt < new Date()) {
    return { statusCode: 400, body: { message: 'Mã xác thực đã hết hạn!' } }
  }

  return { statusCode: 200, body: { message: 'Xác thực thành công!' } }
}

async function resetPassword({ email, code, newPassword }) {
  if (!email || !code || !newPassword) {
    return { statusCode: 400, body: { message: 'Thiếu thông tin!' } }
  }

  const resetCode = await resetCodeRepository.findOne({ email, code, used: false })
  if (!resetCode) {
    return { statusCode: 400, body: { message: 'Mã xác thực không hợp lệ!' } }
  }
  if (resetCode.expiresAt < new Date()) {
    return { statusCode: 400, body: { message: 'Mã xác thực đã hết hạn!' } }
  }

  const user = await userRepository.findOne({ email })
  if (!user) {
    return { statusCode: 404, body: { message: 'User không tồn tại!' } }
  }

  await user.setPassword(newPassword)
  resetCode.used = true
  await resetCode.save()

  return { statusCode: 200, body: { message: 'Đổi mật khẩu thành công!' } }
}

async function updateProfile(userId, payload) {
  const { fullName, avatarUrl, phone } = payload

  if (fullName && fullName.trim() === '') {
    return { statusCode: 400, body: { message: 'Họ tên không được để trống!' } }
  }

  const updateObj = {}
  if (fullName) updateObj.fullName = fullName.trim()
  if (typeof avatarUrl === 'string') updateObj.avatarUrl = avatarUrl
  if (avatarUrl === '') updateObj.avatarUrl = ''
  if (typeof phone === 'string') updateObj.phone = phone

  const updatedUser = await userRepository.updateById(userId, updateObj, { new: true })
  if (!updatedUser) {
    return { statusCode: 404, body: { message: 'Không tìm thấy tài khoản!' } }
  }

  return {
    statusCode: 200,
    body: {
      message: 'Cập nhật thông tin thành công!',
      data: updatedUser
    }
  }
}

async function updateCheckoutProfile(userId, payload) {
  const checkoutProfile = normalizeCheckoutProfile(payload || {})
  const updatedUser = await userRepository.updateById(userId, { checkoutProfile }, { new: true })

  if (!updatedUser) {
    return { statusCode: 404, body: { message: 'Không tìm thấy tài khoản!' } }
  }

  return {
    statusCode: 200,
    body: {
      message: 'Đã lưu thông tin đặt hàng mặc định!',
      data: updatedUser
    }
  }
}

async function requestEmailUpdate(userId, email) {
  if (!email) {
    return { statusCode: 400, body: { message: 'Thiếu email!' } }
  }

  const emailExisted = await userRepository.findOne({ email })
  if (emailExisted) {
    return { statusCode: 400, body: { message: 'Email đã được sử dụng!' } }
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString()
  const expiresAt = new Date(Date.now() + 3 * 60 * 1000)

  await emailUpdateCodeRepository.deleteMany({ userId, newEmail: email })
  await emailUpdateCodeRepository.create({ userId, newEmail: email, code, expiresAt })

  try {
    await sendMail(
      email,
      'Mã xác thực cập nhật email',
      `Mã xác thực của bạn là: ${code}`,
      getVerifyCodeHtml('Mã xác thực cập nhật email', code)
    )
  } catch (err) {
    return { statusCode: 500, body: { message: 'Lỗi gửi mail! ' + err.message } }
  }

  return { statusCode: 200, body: { message: 'Đã gửi mã xác thực tới email mới!' } }
}

async function confirmEmailUpdate(userId, { email, code }) {
  if (!email || !code) {
    return { statusCode: 400, body: { message: 'Thiếu thông tin!' } }
  }

  const otp = await emailUpdateCodeRepository.findOne({ userId, newEmail: email, code, used: false })
  if (!otp) {
    return { statusCode: 400, body: { message: 'Mã xác thực không hợp lệ!' } }
  }
  if (otp.expiresAt < new Date()) {
    return { statusCode: 400, body: { message: 'Mã xác thực đã hết hạn!' } }
  }

  const user = await userRepository.findById(userId)
  if (!user) {
    return { statusCode: 404, body: { message: 'Không tìm thấy user!' } }
  }

  user.email = email
  await user.save()

  otp.used = true
  await otp.save()

  const updatedUser = await userRepository.findById(userId, { select: '-passwordHash' })
  return {
    statusCode: 200,
    body: {
      message: 'Cập nhật email thành công!',
      data: updatedUser
    }
  }
}

async function changePassword(userId, { currentPassword, newPassword }) {
  if (!newPassword) {
    return { statusCode: 400, body: { error: 'Missing new password' } }
  }

  const user = await userRepository.findById(userId)
  if (!user) {
    return { statusCode: 404, body: { error: 'User not found', message: 'User not found' } }
  }

  if (user.hasPassword) {
    if (!currentPassword) {
      return { statusCode: 400, body: { error: 'Missing current password' } }
    }
    const isMatch = await user.comparePassword(currentPassword)
    if (!isMatch) {
      return { statusCode: 401, body: { error: 'Current password is incorrect', message: 'Current password is incorrect' } }
    }
  }

  user.passwordHash = newPassword
  await user.save()

  return {
    statusCode: 200,
    body: {
      message: user.hasPassword ? 'Password changed successfully' : 'Password set successfully'
    }
  }
}

module.exports = {
  login,
  register,
  refreshToken,
  logout,
  createOauthCallback,
  oauthCodeLogin,
  getMe,
  forgotPassword,
  verifyResetCode,
  resetPassword,
  updateProfile,
  updateCheckoutProfile,
  requestEmailUpdate,
  confirmEmailUpdate,
  changePassword
}











