const rateLimit = require('express-rate-limit')

exports.createRateLimiter = (options = {}) => {
  return rateLimit({
    windowMs: options.windowMs || 10 * 60 * 1000,
    max: options.max || 5,
    message: options.message || { message: 'Bạn gửi quá nhiều lần. Vui lòng thử lại sau!' },
    standardHeaders: true,
    legacyHeaders: false
  })
}









