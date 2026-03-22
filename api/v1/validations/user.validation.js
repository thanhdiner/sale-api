const Joi = require('joi')

// ─────────────────────────────────────────────
// CLIENT AUTH
// ─────────────────────────────────────────────

const login = Joi.object({
  identity: Joi.string().min(1).max(100).required().messages({
    'string.empty': 'Tên đăng nhập hoặc email không được để trống',
    'any.required': 'Tên đăng nhập hoặc email là bắt buộc'
  }),
  password: Joi.string().min(1).max(128).required().messages({
    'string.empty': 'Mật khẩu không được để trống',
    'any.required': 'Mật khẩu là bắt buộc'
  }),
  remember: Joi.boolean().optional()
})

const register = Joi.object({
  username: Joi.string()
    .alphanum()
    .min(3)
    .max(30)
    .required()
    .messages({
      'string.alphanum': 'Username chỉ được chứa chữ cái và số',
      'string.min': 'Username phải có ít nhất 3 ký tự',
      'string.max': 'Username tối đa 30 ký tự',
      'any.required': 'Username là bắt buộc'
    }),
  email: Joi.string().email({ tlds: { allow: false } }).required().messages({
    'string.email': 'Email không đúng định dạng',
    'any.required': 'Email là bắt buộc'
  }),
  password: Joi.string().min(6).max(128).required().messages({
    'string.min': 'Mật khẩu phải có ít nhất 6 ký tự',
    'any.required': 'Mật khẩu là bắt buộc'
  }),
  fullName: Joi.string().min(2).max(100).required().messages({
    'string.min': 'Họ và tên phải có ít nhất 2 ký tự',
    'any.required': 'Họ và tên là bắt buộc'
  }),
  phone: Joi.string()
    .pattern(/^[0-9]{9,15}$/)
    .allow('', null)
    .optional()
    .messages({ 'string.pattern.base': 'Số điện thoại không hợp lệ (9-15 chữ số)' })
})

const forgotPassword = Joi.object({
  email: Joi.string().email({ tlds: { allow: false } }).required().messages({
    'string.email': 'Email không đúng định dạng',
    'any.required': 'Email là bắt buộc'
  })
})

const verifyResetCode = Joi.object({
  email: Joi.string().email({ tlds: { allow: false } }).required().messages({
    'string.email': 'Email không đúng định dạng',
    'any.required': 'Email là bắt buộc'
  }),
  code: Joi.string().length(6).pattern(/^\d{6}$/).required().messages({
    'string.length': 'Mã xác thực phải đủ 6 chữ số',
    'string.pattern.base': 'Mã xác thực chỉ gồm chữ số',
    'any.required': 'Mã xác thực là bắt buộc'
  })
})

const resetPassword = Joi.object({
  email: Joi.string().email({ tlds: { allow: false } }).required(),
  code: Joi.string().length(6).pattern(/^\d{6}$/).required().messages({
    'string.length': 'Mã xác thực phải đủ 6 chữ số',
    'string.pattern.base': 'Mã xác thực chỉ gồm chữ số',
    'any.required': 'Mã xác thực là bắt buộc'
  }),
  newPassword: Joi.string().min(6).max(128).required().messages({
    'string.min': 'Mật khẩu mới phải có ít nhất 6 ký tự',
    'any.required': 'Mật khẩu mới là bắt buộc'
  })
})

const updateProfile = Joi.object({
  fullName: Joi.string().min(2).max(100).optional().messages({
    'string.min': 'Họ và tên phải có ít nhất 2 ký tự',
    'string.max': 'Họ và tên tối đa 100 ký tự'
  }),
  avatarUrl: Joi.string().uri().allow('', null).optional().messages({
    'string.uri': 'avatarUrl phải là URL hợp lệ'
  }),
  phone: Joi.string()
    .pattern(/^[0-9]{9,15}$/)
    .allow('', null)
    .optional()
    .messages({ 'string.pattern.base': 'Số điện thoại không hợp lệ (9-15 chữ số)' })
})

const requestEmailUpdate = Joi.object({
  email: Joi.string().email({ tlds: { allow: false } }).required().messages({
    'string.email': 'Email mới không đúng định dạng',
    'any.required': 'Email mới là bắt buộc'
  })
})

const confirmEmailUpdate = Joi.object({
  email: Joi.string().email({ tlds: { allow: false } }).required(),
  code: Joi.string().length(6).pattern(/^\d{6}$/).required().messages({
    'string.length': 'Mã xác thực phải đủ 6 chữ số',
    'any.required': 'Mã xác thực là bắt buộc'
  })
})

const changePassword = Joi.object({
  currentPassword: Joi.string().min(1).max(128).optional(),
  newPassword: Joi.string().min(6).max(128).required().messages({
    'string.min': 'Mật khẩu mới phải có ít nhất 6 ký tự',
    'any.required': 'Mật khẩu mới là bắt buộc'
  })
})

const oauthCodeLogin = Joi.object({
  code: Joi.string().uuid({ version: 'uuidv4' }).required().messages({
    'string.guid': 'Mã OAuth không hợp lệ',
    'any.required': 'Mã OAuth là bắt buộc'
  })
})

module.exports = {
  login,
  register,
  forgotPassword,
  verifyResetCode,
  resetPassword,
  updateProfile,
  requestEmailUpdate,
  confirmEmailUpdate,
  changePassword,
  oauthCodeLogin
}
