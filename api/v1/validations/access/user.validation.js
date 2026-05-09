const Joi = require('joi')

const login = Joi.object({
  identity: Joi.string().min(1).max(100).required().messages({
    'string.empty': 'Ten dang nhap hoac email khong duoc de trong',
    'any.required': 'Ten dang nhap hoac email la bat buoc'
  }),
  password: Joi.string().min(1).max(128).required().messages({
    'string.empty': 'Mat khau khong duoc de trong',
    'any.required': 'Mat khau la bat buoc'
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
      'string.alphanum': 'Username chi duoc chua chu cai va so',
      'string.min': 'Username phai co it nhat 3 ky tu',
      'string.max': 'Username toi da 30 ky tu',
      'any.required': 'Username la bat buoc'
    }),
  email: Joi.string().email({ tlds: { allow: false } }).required().messages({
    'string.email': 'Email khong dung dinh dang',
    'any.required': 'Email la bat buoc'
  }),
  password: Joi.string().min(6).max(128).required().messages({
    'string.min': 'Mat khau phai co it nhat 6 ky tu',
    'any.required': 'Mat khau la bat buoc'
  }),
  fullName: Joi.string().min(2).max(100).required().messages({
    'string.min': 'Ho va ten phai co it nhat 2 ky tu',
    'any.required': 'Ho va ten la bat buoc'
  }),
  phone: Joi.string()
    .pattern(/^[0-9]{9,15}$/)
    .allow('', null)
    .optional()
    .messages({ 'string.pattern.base': 'So dien thoai khong hop le (9-15 chu so)' })
})

const forgotPassword = Joi.object({
  email: Joi.string().email({ tlds: { allow: false } }).required().messages({
    'string.email': 'Email khong dung dinh dang',
    'any.required': 'Email la bat buoc'
  })
})

const verifyResetCode = Joi.object({
  email: Joi.string().email({ tlds: { allow: false } }).required().messages({
    'string.email': 'Email khong dung dinh dang',
    'any.required': 'Email la bat buoc'
  }),
  code: Joi.string().length(6).pattern(/^\d{6}$/).required().messages({
    'string.length': 'Ma xac thuc phai du 6 chu so',
    'string.pattern.base': 'Ma xac thuc chi gom chu so',
    'any.required': 'Ma xac thuc la bat buoc'
  })
})

const resetPassword = Joi.object({
  email: Joi.string().email({ tlds: { allow: false } }).required(),
  code: Joi.string().length(6).pattern(/^\d{6}$/).required().messages({
    'string.length': 'Ma xac thuc phai du 6 chu so',
    'string.pattern.base': 'Ma xac thuc chi gom chu so',
    'any.required': 'Ma xac thuc la bat buoc'
  }),
  newPassword: Joi.string().min(6).max(128).required().messages({
    'string.min': 'Mat khau moi phai co it nhat 6 ky tu',
    'any.required': 'Mat khau moi la bat buoc'
  })
})

const updateProfile = Joi.object({
  fullName: Joi.string().min(2).max(100).optional().messages({
    'string.min': 'Ho va ten phai co it nhat 2 ky tu',
    'string.max': 'Ho va ten toi da 100 ky tu'
  }),
  avatarUrl: Joi.string().uri().allow('', null).optional().messages({
    'string.uri': 'avatarUrl phai la URL hop le'
  }),
  phone: Joi.string()
    .pattern(/^[0-9]{9,15}$/)
    .allow('', null)
    .optional()
    .messages({ 'string.pattern.base': 'So dien thoai khong hop le (9-15 chu so)' })
})

const checkoutProfile = Joi.object({
  firstName: Joi.string().max(50).allow('', null).optional(),
  lastName: Joi.string().max(50).allow('', null).optional(),
  phone: Joi.string()
    .pattern(/^[0-9]{9,15}$/)
    .allow('', null)
    .optional()
    .messages({ 'string.pattern.base': 'So dien thoai khong hop le (9-15 chu so)' }),
  email: Joi.string().email({ tlds: { allow: false } }).allow('', null).optional().messages({
    'string.email': 'Email khong dung dinh dang'
  }),
  addressLine1: Joi.string().max(255).allow('', null).optional(),
  provinceCode: Joi.string().max(20).allow('', null).optional(),
  provinceName: Joi.string().max(120).allow('', null).optional(),
  districtCode: Joi.string().max(20).allow('', null).optional(),
  districtName: Joi.string().max(120).allow('', null).optional(),
  wardCode: Joi.string().max(20).allow('', null).optional(),
  wardName: Joi.string().max(120).allow('', null).optional(),
  address: Joi.string().max(255).allow('', null).optional(),
  notes: Joi.string().max(500).allow('', null).optional(),
  deliveryMethod: Joi.string().valid('pickup', 'contact').optional(),
  paymentMethod: Joi.string().valid('transfer', 'contact', 'vnpay', 'momo', 'zalopay', 'sepay').optional()
}).custom((value, helpers) => {
  const hasStructuredAddress = [
    value.addressLine1,
    value.provinceCode,
    value.provinceName,
    value.districtCode,
    value.districtName,
    value.wardCode,
    value.wardName
  ].some(item => typeof item === 'string' && item.trim())

  if (!hasStructuredAddress) return value

  const requiredFields = [
    'addressLine1',
    'provinceCode',
    'provinceName',
    'districtCode',
    'districtName',
    'wardCode',
    'wardName'
  ]

  const isIncomplete = requiredFields.some(field => !`${value[field] || ''}`.trim())
  if (isIncomplete) {
    return helpers.message('Dia chi co cau truc phai day du tinh/thanh, quan/huyen, phuong/xa va dia chi chi tiet')
  }

  return value
})

const requestEmailUpdate = Joi.object({
  email: Joi.string().email({ tlds: { allow: false } }).required().messages({
    'string.email': 'Email moi khong dung dinh dang',
    'any.required': 'Email moi la bat buoc'
  })
})

const confirmEmailUpdate = Joi.object({
  email: Joi.string().email({ tlds: { allow: false } }).required(),
  code: Joi.string().length(6).pattern(/^\d{6}$/).required().messages({
    'string.length': 'Ma xac thuc phai du 6 chu so',
    'any.required': 'Ma xac thuc la bat buoc'
  })
})

const changePassword = Joi.object({
  currentPassword: Joi.string().min(1).max(128).optional(),
  newPassword: Joi.string().min(6).max(128).required().messages({
    'string.min': 'Mat khau moi phai co it nhat 6 ky tu',
    'any.required': 'Mat khau moi la bat buoc'
  })
})

const oauthCodeLogin = Joi.object({
  code: Joi.string().uuid({ version: 'uuidv4' }).required().messages({
    'string.guid': 'Ma OAuth khong hop le',
    'any.required': 'Ma OAuth la bat buoc'
  })
})

module.exports = {
  login,
  register,
  forgotPassword,
  verifyResetCode,
  resetPassword,
  updateProfile,
  checkoutProfile,
  requestEmailUpdate,
  confirmEmailUpdate,
  changePassword,
  oauthCodeLogin
}










