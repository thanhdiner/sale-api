const jwt = require('jsonwebtoken')

const ACCESS_SECRET = process.env.ACCESS_SECRET

// Like authenticateToken but doesn't reject unauthenticated requests.
// Sets req.user if a valid token exists, otherwise leaves it undefined.
module.exports.authenticateTokenOptional = (req, res, next) => {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]
  if (!token) return next()

  try {
    const decoded = jwt.verify(token, ACCESS_SECRET)
    req.user = decoded
  } catch {
    // invalid / expired token – treat as guest
  }
  next()
}









