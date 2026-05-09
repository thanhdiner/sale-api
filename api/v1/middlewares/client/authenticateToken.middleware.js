const jwt = require('jsonwebtoken')
const AppError = require('../../utils/AppError')

const ACCESS_SECRET = process.env.ACCESS_SECRET

module.exports.authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]
  if (!token) return next(new AppError('Access token is required', 401))

  try {
    const decoded = jwt.verify(token, ACCESS_SECRET)
    req.user = decoded
    next()
  } catch (err) {
    // Pass to global errorHandler — translates TokenExpiredError & JsonWebTokenError
    next(err)
  }
}

module.exports.optionalAuthenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]
  if (!token) return next()

  try {
    const decoded = jwt.verify(token, ACCESS_SECRET)
    req.user = decoded
    next()
  } catch (err) {
    // Ignore error for optional auth
    next()
  }
}









