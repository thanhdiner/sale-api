/**
 * Generic Joi validation middleware factory.
 * Usage: validate(schema, target?)
 *   target: 'body' | 'query' | 'params'  (default: 'body')
 *
 * Example:
 *   router.post('/login', validate(schemas.login), controller.login)
 */
const validate = (schema, target = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[target], {
      abortEarly: false,   // trả về tất cả lỗi, không dừng ở lỗi đầu
      stripUnknown: true,  // loại bỏ các field không được định nghĩa
      convert: true        // tự động convert type (string -> number...)
    })

    if (error) {
      const errors = error.details.map(d => d.message.replace(/['"]/g, ''))
      return res.status(400).json({
        error: 'Dữ liệu không hợp lệ',
        details: errors
      })
    }

    // Gán lại value đã được clean/convert vào req
    req[target] = value
    next()
  }
}

module.exports = validate









