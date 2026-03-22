const Joi = require('joi')

// ─────────────────────────────────────────────
// ADMIN AUTH
// ─────────────────────────────────────────────

const login = Joi.object({
  username: Joi.string().min(1).max(50).required().messages({
    'string.empty': 'Username không được để trống',
    'any.required': 'Username là bắt buộc'
  }),
  password: Joi.string().min(1).max(128).required().messages({
    'string.empty': 'Mật khẩu không được để trống',
    'any.required': 'Mật khẩu là bắt buộc'
  }),
  deviceId: Joi.string().max(128).optional().allow('', null)
})

const verify2FA = Joi.object({
  userId: Joi.string()
    .pattern(/^[a-f\d]{24}$/i)
    .required()
    .messages({ 'any.required': 'userId là bắt buộc' }),
  code: Joi.string().min(4).max(20).required().messages({
    'string.min': 'Mã xác thực quá ngắn',
    'any.required': 'Mã xác thực là bắt buộc'
  }),
  deviceInfo: Joi.string().max(500).optional().allow('', null),
  type: Joi.string().valid('totp', 'backup').default('totp')
})

module.exports = { login, verify2FA }
