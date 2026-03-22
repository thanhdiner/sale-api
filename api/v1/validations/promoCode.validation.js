const Joi = require('joi')

// ─────────────────────────────────────────────
// PROMO CODE (CLIENT - validate)
// ─────────────────────────────────────────────

const validatePromoCode = Joi.object({
  code: Joi.string().min(1).max(50).required().messages({
    'string.empty': 'Mã giảm giá không được để trống',
    'any.required': 'Mã giảm giá là bắt buộc'
  }),
  subtotal: Joi.number().min(0).default(0),
  userId: Joi.string().optional().allow('', null)
})

// ─────────────────────────────────────────────
// PROMO CODE (ADMIN - create / update)
// ─────────────────────────────────────────────

const createPromoCode = Joi.object({
  code: Joi.string().alphanum().min(2).max(50).required().messages({
    'string.alphanum': 'Mã giảm giá chỉ gồm chữ và số',
    'string.min': 'Mã giảm giá phải có ít nhất 2 ký tự',
    'any.required': 'Mã giảm giá là bắt buộc'
  }),
  discountType: Joi.string().valid('percent', 'fixed').required().messages({
    'any.only': 'discountType phải là percent hoặc fixed',
    'any.required': 'discountType là bắt buộc'
  }),
  discountValue: Joi.number().min(0).required().messages({ 'any.required': 'discountValue là bắt buộc' }),
  maxDiscount: Joi.number().min(0).optional().allow(null),
  minOrder: Joi.number().min(0).default(0),
  usageLimit: Joi.number().integer().min(1).optional().allow(null),
  expiresAt: Joi.date().iso().optional().allow(null),
  isActive: Joi.boolean().default(true),
  description: Joi.string().max(500).allow('', null).optional()
})

const updatePromoCode = Joi.object({
  code: Joi.string().alphanum().min(2).max(50).optional(),
  discountType: Joi.string().valid('percent', 'fixed').optional(),
  discountValue: Joi.number().min(0).optional(),
  maxDiscount: Joi.number().min(0).optional().allow(null),
  minOrder: Joi.number().min(0).optional(),
  usageLimit: Joi.number().integer().min(1).optional().allow(null),
  expiresAt: Joi.date().iso().optional().allow(null),
  isActive: Joi.boolean().optional(),
  description: Joi.string().max(500).allow('', null).optional()
})

module.exports = {
  validatePromoCode,
  createPromoCode,
  updatePromoCode
}
