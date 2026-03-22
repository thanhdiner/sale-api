const logger = require('../../../config/logger')
const AppError = require('../utils/AppError')

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Extract a safe, consistent error response payload.
 * In production, never leak stack traces or internal messages to the client.
 */
const buildResponse = (err, isDev) => {
  const base = {
    success: false,
    statusCode: err.statusCode || 500,
    error: err.message || 'Internal Server Error'
  }

  if (err.details) base.details = err.details

  if (isDev) {
    base.stack = err.stack
    base.name = err.name
  }

  return base
}

// ─── Known error translators ──────────────────────────────────────────────────

/** Mongoose CastError – invalid ObjectId */
const handleCastError = err =>
  new AppError(`Giá trị không hợp lệ tại trường '${err.path}': ${err.value}`, 400)

/** Mongoose duplicate key (E11000) */
const handleDuplicateKeyError = err => {
  const field = Object.keys(err.keyValue || {})[0] || 'field'
  const value = err.keyValue?.[field]
  return new AppError(`Giá trị '${value}' cho trường '${field}' đã tồn tại.`, 409)
}

/** Mongoose ValidationError */
const handleValidationError = err => {
  const details = Object.values(err.errors).map(e => e.message)
  return new AppError('Dữ liệu không hợp lệ', 400, details)
}

/** JWT expired */
const handleJWTExpiredError = () =>
  new AppError('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.', 401)

/** JWT malformed / invalid signature */
const handleJWTError = () =>
  new AppError('Token không hợp lệ, vui lòng đăng nhập lại.', 401)

/** Multer / file upload limit */
const handleMulterError = err => {
  if (err.code === 'LIMIT_FILE_SIZE')
    return new AppError('File vượt quá kích thước cho phép.', 413)
  if (err.code === 'LIMIT_UNEXPECTED_FILE')
    return new AppError(`Field '${err.field}' không được phép upload.`, 400)
  return new AppError('Lỗi upload file.', 400)
}

/** SyntaxError from express.json() – malformed JSON body */
const handleSyntaxError = () =>
  new AppError('Request body không hợp lệ (JSON syntax error).', 400)

// ─── Main Global Error Handler ────────────────────────────────────────────────

/**
 * Express global error handler — must be registered LAST with 4 parameters.
 *
 * Handles:
 *   - AppError     (intentional operational errors thrown in controllers)
 *   - Mongoose     (CastError, ValidationError, E11000)
 *   - JWT          (JsonWebTokenError, TokenExpiredError)
 *   - Multer       (LIMIT_FILE_SIZE, LIMIT_UNEXPECTED_FILE)
 *   - SyntaxError  (malformed JSON body)
 *   - Unhandled    (generic 500 — stack logged, generic message sent)
 */
const errorHandler = (err, req, res, next) => { // eslint-disable-line no-unused-vars
  const isDev = process.env.NODE_ENV !== 'production'
  let error = err

  // ── Translate known library errors into AppError ──────────────────────────
  if (err.name === 'CastError')                      error = handleCastError(err)
  else if (err.code === 11000)                       error = handleDuplicateKeyError(err)
  else if (err.name === 'ValidationError')           error = handleValidationError(err)
  else if (err.name === 'TokenExpiredError')         error = handleJWTExpiredError()
  else if (err.name === 'JsonWebTokenError')         error = handleJWTError()
  else if (err.name === 'MulterError')               error = handleMulterError(err)
  else if (err instanceof SyntaxError && err.status === 400) error = handleSyntaxError()

  // ── Determine severity ────────────────────────────────────────────────────
  const statusCode = error.statusCode || 500
  const isOperational = error.isOperational === true

  if (isOperational) {
    // Expected errors – warn level (e.g. 400, 401, 403, 404, 409)
    logger.warn(`[ErrorHandler] ${req.method} ${req.originalUrl} → ${statusCode}: ${error.message}`)
  } else {
    // Unexpected bugs – log full error with stack trace
    logger.error(`[ErrorHandler] Unhandled error on ${req.method} ${req.originalUrl}`, {
      statusCode,
      message: err.message,
      stack: err.stack
    })
  }

  // ── Send response ─────────────────────────────────────────────────────────
  const body = buildResponse(error, isDev)

  // Never expose internals of programming bugs in production
  if (!isOperational && !isDev) {
    body.error = 'Đã có lỗi xảy ra từ máy chủ, vui lòng thử lại sau.'
    delete body.stack
    delete body.name
  }

  res.status(statusCode).json(body)
}

module.exports = errorHandler
