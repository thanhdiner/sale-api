const AppError = require('../utils/AppError')

/**
 * 404 Not Found handler.
 * Mount AFTER all routes so it catches any unmatched request.
 *
 * Usage in index.js:
 *   app.use(notFound)
 *   app.use(errorHandler)   // must come after notFound
 */
const notFound = (req, res, next) => {
  next(new AppError(`Route không tồn tại: ${req.method} ${req.originalUrl}`, 404))
}

module.exports = notFound
