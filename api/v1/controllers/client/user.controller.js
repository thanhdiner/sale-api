const User = require('../../models/user.model')
const ResetCode = require('../../models/resetCode.model')
const EmailUpdateCode = require('../../models/emailUpdateCode.model')
const ClientRefreshToken = require('../../models/clientRefreshToken.model')
const jwt = require('jsonwebtoken')
const ms = require('ms')
const { v4: uuidv4 } = require('uuid')
const OauthCode = require('../../models/OauthCodeSchema')
const sendMail = require('../../utils/sendMail')
const { getVerifyCodeHtml } = require('../../utils/emailTemplates')

const ACCESS_SECRET = process.env.ACCESS_SECRET
const REFRESH_SECRET = process.env.REFRESH_SECRET
const JWT_EXPIRES_IN_ACCESS = process.env.JWT_EXPIRES_IN_ACCESS || '1h'
const JWT_EXPIRES_IN_REFRESH = process.env.JWT_EXPIRES_IN_REFRESH || '30d'

//# POST /api/v1/user/login
module.exports.login = async (req, res) => {
  try {
    const { identity, password, remember } = req.body

    const user = await User.findOne({
      $or: [{ username: identity }, { email: identity }]
    })
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ error: 'Tài khoản hoặc mật khẩu không đúng!' })
    }

    user.lastLogin = new Date()
    await user.save()

    const clientAccessToken = jwt.sign({ userId: user._id, username: user.username }, ACCESS_SECRET, { expiresIn: JWT_EXPIRES_IN_ACCESS })

    const refreshToken = jwt.sign({ userId: user._id, username: user.username }, REFRESH_SECRET, { expiresIn: JWT_EXPIRES_IN_REFRESH })
    const refreshExpiresAt = new Date(Date.now() + ms(JWT_EXPIRES_IN_REFRESH))

    await ClientRefreshToken.deleteMany({ userId: user._id })
    await ClientRefreshToken.create({
      userId: user._id,
      token: refreshToken,
      expiresAt: refreshExpiresAt
    })

    const cookieOptions = {
      httpOnly: true,
      sameSite: 'lax'
    }
    if (remember) {
      cookieOptions.maxAge = ms(JWT_EXPIRES_IN_REFRESH)
    }

    res.cookie('clientRefreshToken', refreshToken, cookieOptions)
    res.json({
      message: 'Đăng nhập thành công!',
      clientAccessToken,
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        lastLogin: user.lastLogin
      }
    })
  } catch (err) {
    res.status(500).json({ error: 'Lỗi server!' })
  }
}

//# POST /api/v1/user/register
module.exports.register = async (req, res) => {
  try {
    const { username, email, password, fullName, phone } = req.body

    const existingUser = await User.findOne({
      $or: [{ username }, { email }]
    })
    if (existingUser) {
      return res.status(400).json({ error: 'Username hoặc email đã được sử dụng!' })
    }

    const newUser = new User({
      username,
      email,
      phone,
      passwordHash: password,
      fullName
    })

    await newUser.save()

    return res.status(201).json({ message: 'Đăng ký thành công! Vui lòng đăng nhập.' })
  } catch (err) {
    return res.status(500).json({ error: 'Lỗi máy chủ! ' + err.message })
  }
}

//# POST /api/v1/user/refresh-token
module.exports.refreshToken = async (req, res) => {
  try {
    const { clientRefreshToken } = req.cookies

    if (!clientRefreshToken) return res.status(401).json({ error: 'Không có refresh token' })

    const dbToken = await ClientRefreshToken.findOne({ token: clientRefreshToken })
    if (!dbToken) return res.status(403).json({ error: 'Refresh token không hợp lệ' })

    if (dbToken.expiresAt < new Date()) {
      await ClientRefreshToken.deleteOne({ token: clientRefreshToken })
      return res.status(403).json({ error: 'Refresh token đã hết hạn' })
    }

    let decoded
    try {
      decoded = jwt.verify(clientRefreshToken, REFRESH_SECRET)
    } catch (err) {
      return res.status(401).json({ error: 'Refresh token không hợp lệ hoặc đã hết hạn' })
    }

    const user = await User.findById(decoded.userId)
    if (!user) return res.status(401).json({ error: 'Không tìm thấy tài khoản' })

    const newAccessToken = jwt.sign({ userId: user._id, username: user.username }, ACCESS_SECRET, { expiresIn: JWT_EXPIRES_IN_ACCESS })

    res.json({
      clientAccessToken: newAccessToken,
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        fullName: user.fullName
      }
    })
  } catch (error) {
    res.status(500).json({ error: 'Có lỗi xảy ra, vui lòng thử lại sau!' })
  }
}

//# POST /api/v1/user/logout
module.exports.logout = async (req, res) => {
  try {
    const { clientRefreshToken } = req.cookies
    if (clientRefreshToken) {
      await ClientRefreshToken.deleteOne({ token: clientRefreshToken })
      res.clearCookie('clientRefreshToken', {
        httpOnly: true,
        sameSite: 'lax'
      })
    }
    res.sendStatus(204)
  } catch (error) {
    res.status(500).json({ error: 'Đăng xuất thất bại, vui lòng thử lại sau!' })
  }
}

//# GET /api/v1/user/google/callback
module.exports.googleLoginCallback = async (req, res) => {
  try {
    const user = req.user
    const code = uuidv4()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 phút

    await OauthCode.create({
      code,
      userId: user._id,
      expiresAt
    })

    res.redirect(`${process.env.CLIENT_URL}/user/oauth-callback?code=${code}`)
  } catch (err) {
    res.status(500).send('Lỗi đăng nhập Google!')
  }
}

//# POST /api/v1/user/oauth-code-login
module.exports.oauthCodeLogin = async (req, res) => {
  try {
    const { code } = req.body

    if (!code) return res.status(400).json({ error: 'Thiếu mã code' })

    const oauthCode = await OauthCode.findOne({ code, used: false })
    if (!oauthCode) return res.status(400).json({ error: 'Mã code không hợp lệ hoặc đã sử dụng' })
    if (oauthCode.expiresAt < new Date()) return res.status(400).json({ error: 'Mã code đã hết hạn' })

    const user = await User.findById(oauthCode.userId)
    if (!user) return res.status(404).json({ error: 'User không tồn tại' })

    user.lastLogin = new Date()
    await user.save()

    const clientAccessToken = jwt.sign({ userId: user._id, username: user.username }, ACCESS_SECRET, { expiresIn: JWT_EXPIRES_IN_ACCESS })
    const refreshToken = jwt.sign({ userId: user._id, username: user.username }, REFRESH_SECRET, { expiresIn: JWT_EXPIRES_IN_REFRESH })
    const refreshExpiresAt = new Date(Date.now() + ms(JWT_EXPIRES_IN_REFRESH))

    await ClientRefreshToken.deleteMany({ userId: user._id })
    await ClientRefreshToken.create({
      userId: user._id,
      token: refreshToken,
      expiresAt: refreshExpiresAt
    })

    oauthCode.used = true
    await oauthCode.save()

    res.cookie('clientRefreshToken', refreshToken, {
      httpOnly: true,
      sameSite: 'lax'
    })

    res.json({
      clientAccessToken,
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        avatarUrl: user.avatarUrl,
        lastLogin: user.lastLogin
      }
    })
  } catch (err) {
    res.status(500).json({ error: 'Có lỗi xảy ra, vui lòng thử lại!' })
  }
}

//# GET /api/v1/user/me
module.exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-passwordHash -__v')
    if (!user) return res.status(404).json({ error: 'User not found' })
    res.json(user)
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
}

//# GET /api/v1/user/facebook/callback
module.exports.facebookLoginCallback = async (req, res) => {
  try {
    const user = req.user
    const code = uuidv4()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 phút

    await OauthCode.create({
      code,
      userId: user._id,
      expiresAt
    })

    res.redirect(`${process.env.CLIENT_URL}/user/oauth-callback?code=${code}`)
  } catch (err) {
    res.status(500).send('Lỗi đăng nhập Facebook!')
  }
}

//# GET /api/v1/user/github/callback
module.exports.githubLoginCallback = async (req, res) => {
  try {
    const user = req.user
    const code = uuidv4()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000)

    await OauthCode.create({
      code,
      userId: user._id,
      expiresAt
    })

    res.redirect(`${process.env.CLIENT_URL}/user/oauth-callback?code=${code}`)
  } catch (err) {
    console.error('githubLoginCallback error:', err)
    res.status(500).send('Lỗi đăng nhập GitHub!')
  }
}

//# POST /api/v1/user/forgot-password
exports.forgotPassword = async (req, res) => {
  const { email } = req.body
  if (!email) return res.status(400).json({ message: 'Email là bắt buộc!' })
  const user = await User.findOne({ email })
  if (!user) return res.status(404).json({ message: 'Không tìm thấy user với email này!' })

  const code = Math.floor(100000 + Math.random() * 900000).toString()
  const expiresAt = new Date(Date.now() + 3 * 60 * 1000) // 3 phút

  await ResetCode.deleteMany({ email })
  await ResetCode.create({ email, code, expiresAt })

  try {
    await sendMail(
      email,
      'Mã xác thực đặt lại mật khẩu',
      `Mã xác thực của bạn là: ${code}`,
      getVerifyCodeHtml('Mã xác thực đặt lại mật khẩu', code)
    )
  } catch (err) {
    return res.status(500).json({ message: 'Lỗi gửi mail! ' + err.message })
  }

  res.json({ message: 'Đã gửi mã xác thực tới email!' })
}

//# POST /api/v1/user/verify-reset-code
exports.verifyResetCode = async (req, res) => {
  const { email, code } = req.body
  if (!email || !code) return res.status(400).json({ message: 'Thiếu email hoặc mã xác thực!' })
  const resetCode = await ResetCode.findOne({ email, code, used: false })
  if (!resetCode) return res.status(400).json({ message: 'Mã xác thực không hợp lệ!' })
  if (resetCode.expiresAt < new Date()) return res.status(400).json({ message: 'Mã xác thực đã hết hạn!' })

  res.json({ message: 'Xác thực thành công!' })
}

//# POST /api/v1/user/reset-password
exports.resetPassword = async (req, res) => {
  const { email, code, newPassword } = req.body
  if (!email || !code || !newPassword) return res.status(400).json({ message: 'Thiếu thông tin!' })

  const resetCode = await ResetCode.findOne({ email, code, used: false })
  if (!resetCode) return res.status(400).json({ message: 'Mã xác thực không hợp lệ!' })
  if (resetCode.expiresAt < new Date()) return res.status(400).json({ message: 'Mã xác thực đã hết hạn!' })

  const user = await User.findOne({ email })
  if (!user) return res.status(404).json({ message: 'User không tồn tại!' })

  await user.setPassword(newPassword)
  resetCode.used = true
  await resetCode.save()

  res.json({ message: 'Đổi mật khẩu thành công!' })
}

//# PATCH /api/v1/user/update-profile
module.exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.userId
    const { fullName, avatarUrl, phone } = req.body

    if (fullName && fullName.trim() === '') {
      return res.status(400).json({ message: 'Họ tên không được để trống!' })
    }

    const updateObj = {}
    if (fullName) updateObj.fullName = fullName.trim()
    if (typeof avatarUrl === 'string') updateObj.avatarUrl = avatarUrl
    if (avatarUrl === '') updateObj.avatarUrl = ''
    if (typeof phone === 'string') updateObj.phone = phone

    const updatedUser = await User.findByIdAndUpdate(userId, updateObj, { new: true }).select('-passwordHash')
    if (!updatedUser) return res.status(404).json({ message: 'Không tìm thấy tài khoản!' })

    res.status(200).json({
      message: 'Cập nhật thông tin thành công!',
      data: updatedUser
    })
  } catch (err) {
    res.status(500).json({ message: 'Lỗi máy chủ khi cập nhật profile!' })
  }
}

//# POST /api/v1/user/request-email-update
exports.requestEmailUpdate = async (req, res) => {
  const userId = req.user.userId
  const { email } = req.body
  if (!email) return res.status(400).json({ message: 'Thiếu email!' })

  const emailExisted = await User.findOne({ email })
  if (emailExisted) return res.status(400).json({ message: 'Email đã được sử dụng!' })

  const code = Math.floor(100000 + Math.random() * 900000).toString()
  const expiresAt = new Date(Date.now() + 3 * 60 * 1000) // 3 phút

  await EmailUpdateCode.deleteMany({ userId, newEmail: email })
  await EmailUpdateCode.create({ userId, newEmail: email, code, expiresAt })

  try {
    await sendMail(
      email,
      'Mã xác thực cập nhật email',
      `Mã xác thực của bạn là: ${code}`,
      getVerifyCodeHtml('Mã xác thực cập nhật email', code)
    )
    res.json({ message: 'Đã gửi mã xác thực tới email mới!' })
  } catch (err) {
    res.status(500).json({ message: 'Lỗi gửi mail! ' + err.message })
  }
}

//# POST /api/v1/user/confirm-email-update
exports.confirmEmailUpdate = async (req, res) => {
  const userId = req.user.userId
  const { email, code } = req.body
  if (!email || !code) return res.status(400).json({ message: 'Thiếu thông tin!' })

  const otp = await EmailUpdateCode.findOne({ userId, newEmail: email, code, used: false })
  if (!otp) return res.status(400).json({ message: 'Mã xác thực không hợp lệ!' })
  if (otp.expiresAt < new Date()) return res.status(400).json({ message: 'Mã xác thực đã hết hạn!' })

  const user = await User.findById(userId)
  if (!user) return res.status(404).json({ message: 'Không tìm thấy user!' })

  user.email = email
  await user.save()

  otp.used = true
  await otp.save()

  const updatedUser = await User.findById(userId).select('-passwordHash')
  res.json({
    message: 'Cập nhật email thành công!',
    data: updatedUser
  })
}
