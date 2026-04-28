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

const promoCodeTranslationSchema = Joi.object({
  en: Joi.object({
    title: Joi.string().max(200).allow('', null).optional(),
    description: Joi.string().max(1000).allow('', null).optional()
  }).optional()
}).optional()

const promoCodeCategorySchema = Joi.string().valid('all', 'new', 'flash', 'shipping', 'vip', 'weekend', 'student')
const promoCodeAudienceTypeSchema = Joi.string().valid('all_customers', 'new_customers', 'specific_customers', 'customer_groups')
const promoCodeStringArraySchema = Joi.array().items(Joi.string().trim().max(200)).optional()

// ─────────────────────────────────────────────
// PROMO CODE (ADMIN - create / update)
// ─────────────────────────────────────────────

const createPromoCode = Joi.object({
  code: Joi.string().alphanum().min(2).max(50).required().messages({
    'string.alphanum': 'Mã giảm giá chỉ gồm chữ và số',
    'string.min': 'Mã giảm giá phải có ít nhất 2 ký tự',
    'any.required': 'Mã giảm giá là bắt buộc'
  }),
  title: Joi.string().max(200).allow('', null).optional(),
  description: Joi.string().max(1000).allow('', null).optional(),
  translations: promoCodeTranslationSchema,
  category: promoCodeCategorySchema.default('all'),
  discountType: Joi.string().valid('percent', 'fixed').required().messages({
    'any.only': 'discountType phải là percent hoặc fixed',
    'any.required': 'discountType là bắt buộc'
  }),
  discountValue: Joi.number().min(0).required().messages({ 'any.required': 'discountValue là bắt buộc' }),
  maxDiscount: Joi.number().min(0).optional().allow(null),
  minOrder: Joi.number().min(0).default(0),
  applicableProducts: promoCodeStringArraySchema,
  applicableCategories: promoCodeStringArraySchema,
  excludedProducts: promoCodeStringArraySchema,
  usageLimit: Joi.number().integer().min(1).optional().allow(null),
  usagePerCustomer: Joi.number().integer().min(1).default(1),
  newCustomersOnly: Joi.boolean().default(false),
  audienceType: promoCodeAudienceTypeSchema.default('all_customers'),
  specificCustomers: promoCodeStringArraySchema,
  customerGroups: promoCodeStringArraySchema,
  startsAt: Joi.date().iso().optional().allow(null),
  expiresAt: Joi.date().iso().optional().allow(null),
  isActive: Joi.boolean().default(true)
})

const updatePromoCode = Joi.object({
  code: Joi.string().alphanum().min(2).max(50).optional(),
  title: Joi.string().max(200).allow('', null).optional(),
  description: Joi.string().max(1000).allow('', null).optional(),
  translations: promoCodeTranslationSchema,
  category: promoCodeCategorySchema.optional(),
  discountType: Joi.string().valid('percent', 'fixed').optional(),
  discountValue: Joi.number().min(0).optional(),
  maxDiscount: Joi.number().min(0).optional().allow(null),
  minOrder: Joi.number().min(0).optional(),
  applicableProducts: promoCodeStringArraySchema,
  applicableCategories: promoCodeStringArraySchema,
  excludedProducts: promoCodeStringArraySchema,
  usageLimit: Joi.number().integer().min(1).optional().allow(null),
  usagePerCustomer: Joi.number().integer().min(1).optional(),
  newCustomersOnly: Joi.boolean().optional(),
  audienceType: promoCodeAudienceTypeSchema.optional(),
  specificCustomers: promoCodeStringArraySchema,
  customerGroups: promoCodeStringArraySchema,
  startsAt: Joi.date().iso().optional().allow(null),
  expiresAt: Joi.date().iso().optional().allow(null),
  isActive: Joi.boolean().optional()
})

module.exports = {
  validatePromoCode,
  createPromoCode,
  updatePromoCode
}
