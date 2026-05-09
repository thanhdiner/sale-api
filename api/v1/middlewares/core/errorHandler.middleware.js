const logger = require('../../../../config/logger')
const AppError = require('../../utils/AppError')

const buildResponse = (err, isDev) => {
  const body = {
    success: false,
    statusCode: err.statusCode || 500,
    error: err.message || 'Internal Server Error'
  }

  if (err.details) body.details = err.details
  if (isDev) Object.assign(body, { stack: err.stack, name: err.name })

  return body
}

const handleCastError = err =>
  new AppError(`Giá trị không hợp lệ tại trường '${err.path}': ${err.value}`, 400)

const handleDuplicateKeyError = err => {
  const field = Object.keys(err.keyValue || {})[0] || 'field'
  const value = err.keyValue?.[field]
  return new AppError(`Giá trị '${value}' cho trường '${field}' đã tồn tại.`, 409)
}

const handleValidationError = err => {
  const details = Object.values(err.errors).map(e => e.message)
  return new AppError('Dữ liệu không hợp lệ', 400, details)
}

const handleJWTExpiredError = () =>
  new AppError('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.', 401)

const handleJWTError = () =>
  new AppError('Token không hợp lệ, vui lòng đăng nhập lại.', 401)

const handleMulterError = err => {
  if (err.code === 'LIMIT_FILE_SIZE') return new AppError('File vượt quá kích thước cho phép.', 413)
  if (err.code === 'LIMIT_UNEXPECTED_FILE') return new AppError(`Field '${err.field}' không được phép upload.`, 400)
  return new AppError('Lỗi upload file.', 400)
}

const handleSyntaxError = () =>
  new AppError('Request body không hợp lệ (JSON syntax error).', 400)

const translateError = err => {
  if (err.name === 'CastError') return handleCastError(err)
  if (err.code === 11000) return handleDuplicateKeyError(err)
  if (err.name === 'ValidationError') return handleValidationError(err)
  if (err.name === 'TokenExpiredError') return handleJWTExpiredError()
  if (err.name === 'JsonWebTokenError') return handleJWTError()
  if (err.name === 'MulterError') return handleMulterError(err)
  if (err instanceof SyntaxError && err.status === 400) return handleSyntaxError()
  return err
}

const errorHandler = (err, req, res, next) => { // eslint-disable-line no-unused-vars
  const isDev = process.env.NODE_ENV !== 'production'
  const error = translateError(err)
  const statusCode = error.statusCode || 500
  const isOperational = error.isOperational === true

  if (isOperational) {
    logger.warn(`[ErrorHandler] ${req.method} ${req.originalUrl} → ${statusCode}: ${error.message}`)
  } else {
    logger.error(`[ErrorHandler] Unhandled error on ${req.method} ${req.originalUrl}`, {
      statusCode,
      message: err.message,
      stack: err.stack
    })
  }

  const body = buildResponse(error, isDev)

  if (!isOperational && !isDev) {
    body.error = 'Đã có lỗi xảy ra từ máy chủ, vui lòng thử lại sau.'
    delete body.stack
    delete body.name
  }

  res.status(statusCode).json(body)
}

module.exports = errorHandler









