const morgan = require('morgan')
const logger = require('../../../config/logger')

// ─── Custom token: response time kèm đơn vị ────────────────────────────────
morgan.token('response-time-ms', (req, res) => {
  const diff = morgan['response-time'](req, res)
  return diff ? `${diff}ms` : '-'
})

// ─── Format tuỳ chỉnh ──────────────────────────────────────────────────────
// Ví dụ output: "POST /api/v1/user/login 200 12ms"
const morganFormat = ':method :url :status :response-time-ms'

// ─── Bỏ qua health-check / static / favicon ────────────────────────────────
const skip = (req) => {
  const skipPaths = ['/health', '/favicon.ico']
  return skipPaths.includes(req.url)
}

// ─── Export middleware ───────────────────────────────────────────────────────
const morganMiddleware = morgan(morganFormat, {
  stream: logger.stream,
  skip
})

module.exports = morganMiddleware
