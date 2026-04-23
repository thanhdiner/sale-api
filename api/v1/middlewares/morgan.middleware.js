const morgan = require('morgan')
const logger = require('../../../config/logger')

// Token thời gian response có kèm ms
morgan.token('response-time-ms', (req, res) => {
  const diff = morgan['response-time'](req, res)
  return diff ? `${diff}ms` : '-'
})

// Format log: POST /api/v1/user/login 200 12ms
const morganFormat = ':method :url :status :response-time-ms'

// Bỏ qua một số path không cần log
const skip = req => {
  const skipPaths = ['/health', '/favicon.ico']
  return skipPaths.includes(req.url)
}

// Middleware log request
const morganMiddleware = morgan(morganFormat, {
  stream: logger.stream,
  skip
})

module.exports = morganMiddleware