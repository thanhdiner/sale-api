/**
 * Custom Error class for operational errors.
 * Use this to throw known, expected errors (e.g. resource not found, unauthorized).
 *
 * Usage:
 *   throw new AppError('Resource not found', 404)
 *   throw new AppError('Unauthorized', 401)
 *   throw new AppError('Validation failed', 400, { field: 'email' })
 */
class AppError extends Error {
  /**
   * @param {string}  message    - Human-readable error message
   * @param {number}  statusCode - HTTP status code (default: 500)
   * @param {object}  [details]  - Optional extra context (field errors, etc.)
   */
  constructor(message, statusCode = 500, details = null) {
    super(message)
    this.name = 'AppError'
    this.statusCode = statusCode
    this.details = details
    this.isOperational = true          // mark as safe-to-expose to client

    // Maintains proper stack trace in V8 engines
    Error.captureStackTrace(this, this.constructor)
  }
}

module.exports = AppError
