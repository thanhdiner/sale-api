const Joi = require('joi')

const accountTranslationSchema = Joi.object({
  en: Joi.object({
    fullName: Joi.string().max(100).allow('', null).optional()
  }).optional()
}).optional()

const mongoId = Joi.string()
  .pattern(/^[a-f\d]{24}$/i)
  .messages({ 'string.pattern.base': 'ID không hợp lệ' })

// ─────────────────────────────────────────────
// ADMIN ACCOUNTS
// ─────────────────────────────────────────────

const createAccount = Joi.object({
  username: Joi.string()
    .pattern(/^[a-zA-Z0-9_]+$/)
    .min(3)
    .max(30)
    .required()
    .messages({
      'string.pattern.base': 'Username chỉ được chứa chữ cái, số và dấu _',
      'string.min': 'Username phải có ít nhất 3 ký tự',
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
    'any.required': 'Họ và tên là bắt buộc'
  }),
  role_id: mongoId.optional().allow('', null),
  status: Joi.string().valid('active', 'inactive', 'banned').default('active'),
  translations: accountTranslationSchema,
  avatarUrl: Joi.string().uri().allow('', null).optional()
})

const editAccount = Joi.object({
  email: Joi.string().email({ tlds: { allow: false } }).required().messages({
    'string.email': 'Email không đúng định dạng',
    'any.required': 'Email là bắt buộc'
  }),
  fullName: Joi.string().min(2).max(100).optional(),
  role_id: mongoId.optional().allow('', null),
  status: Joi.string().valid('active', 'inactive', 'banned').optional(),
  translations: accountTranslationSchema,
  avatarUrl: Joi.string().uri().allow('', null).optional(),
  newPassword: Joi.string().min(6).max(128).optional().allow('', null)
})

const changeStatus = Joi.object({
  status: Joi.string().valid('active', 'inactive', 'banned').required().messages({
    'any.only': 'Trạng thái phải là active, inactive hoặc banned',
    'any.required': 'status là bắt buộc'
  })
})

const updateAvatar = Joi.object({
  avatarUrl: Joi.string().uri().allow('').required().messages({
    'string.uri': 'avatarUrl phải là URL hợp lệ',
    'any.required': 'avatarUrl là bắt buộc'
  })
})

const updateProfile = Joi.object({
  fullName: Joi.string().min(2).max(100).required().messages({
    'string.min': 'Họ tên phải có ít nhất 2 ký tự',
    'any.required': 'Họ và tên là bắt buộc'
  })
})

const changePassword = Joi.object({
  currentPassword: Joi.string().min(1).max(128).required().messages({
    'any.required': 'Mật khẩu hiện tại là bắt buộc'
  }),
  newPassword: Joi.string().min(6).max(128).required().messages({
    'string.min': 'Mật khẩu mới phải có ít nhất 6 ký tự',
    'any.required': 'Mật khẩu mới là bắt buộc'
  })
})

const verify2FACode = Joi.object({
  code: Joi.string().min(4).max(20).required().messages({
    'any.required': 'Mã xác thực là bắt buộc'
  })
})

const trustDevice = Joi.object({
  deviceId: Joi.string().min(1).max(128).required().messages({
    'any.required': 'deviceId là bắt buộc'
  }),
  name: Joi.string().max(200).optional().allow('', null),
  browser: Joi.string().max(200).optional().allow('', null),
  location: Joi.string().max(200).optional().allow('', null)
})

module.exports = {
  createAccount,
  editAccount,
  changeStatus,
  updateAvatar,
  updateProfile,
  changePassword,
  verify2FACode,
  trustDevice
}










