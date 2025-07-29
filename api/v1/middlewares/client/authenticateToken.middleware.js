const jwt = require('jsonwebtoken')

const ACCESS_SECRET = process.env.ACCESS_SECRET

module.exports.authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]
  if (!token) return res.status(401).json({ message: 'Access token is required' })

  try {
    const decoded = jwt.verify(token, ACCESS_SECRET)
    req.user = decoded
    next()
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Access token expired' })
    }
    return res.status(403).json({ message: 'Invalid access token' })
  }
}
