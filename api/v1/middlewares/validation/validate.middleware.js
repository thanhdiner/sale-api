const AppError = require('../../utils/AppError')

/**
 * Generic Joi validation middleware factory.
 * Usage: validate(schema, target?)
 *   target: 'body' | 'query' | 'params' (default: 'body')
 */
const validate = (schema, target = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[target], {
      abortEarly: false,
      stripUnknown: true,
      convert: true
    })

    if (error) {
      const errors = error.details.map(d => d.message.replace(/['"]/g, ''))
      return next(new AppError('Invalid request data', 400, errors))
    }

    req[target] = value
    next()
  }
}

module.exports = validate
