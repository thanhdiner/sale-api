const RefreshToken = require('../models/access/refreshToken.model')
const jwt = require('jsonwebtoken')
const ms = require('ms')

const ACCESS_SECRET = process.env.ACCESS_SECRET
const REFRESH_SECRET = process.env.REFRESH_SECRET
const JWT_EXPIRES_IN_ACCESS = process.env.JWT_EXPIRES_IN_ACCESS || '1h'
const JWT_EXPIRES_IN_REFRESH = process.env.JWT_EXPIRES_IN_REFRESH || '30d'

function formatUser(admin) {
  const user = admin.toObject ? admin.toObject() : { ...admin }
  delete user.passwordHash
  delete user.__v
  return user
}

async function issueTokensAndRespond(res, admin) {
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
    sameSite: 'lax'
  })

  const user = admin.toObject()
  delete user.passwordHash
  delete user.__v

  res.json({
    accessToken,
    user: formatUser(admin)
  })
}

module.exports = { formatUser, issueTokensAndRespond }









