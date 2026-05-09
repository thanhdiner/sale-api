const Joi = require('joi')

// ─────────────────────────────────────────────
// CART
// ─────────────────────────────────────────────

const mongoId = Joi.string()
  .pattern(/^[a-f\d]{24}$/i)
  .messages({ 'string.pattern.base': 'ID không hợp lệ (phải là MongoDB ObjectId)' })

const addToCart = Joi.object({
  productId: mongoId.required().messages({ 'any.required': 'productId là bắt buộc' }),
  quantity: Joi.number().integer().min(1).max(9999).default(1).messages({
    'number.min': 'Số lượng phải ít nhất là 1',
    'number.max': 'Số lượng tối đa 9999',
    'number.integer': 'Số lượng phải là số nguyên'
  }),
  salePrice: Joi.number().min(0).optional(),
  discountPercent: Joi.number().min(0).max(100).optional(),
  isFlashSale: Joi.boolean().optional(),
  flashSaleId: mongoId.optional().allow('', null)
})

const updateCart = Joi.object({
  productId: mongoId.required().messages({ 'any.required': 'productId là bắt buộc' }),
  quantity: Joi.number().integer().min(1).max(9999).required().messages({
    'number.min': 'Số lượng phải ít nhất là 1',
    'any.required': 'quantity là bắt buộc'
  })
})

const removeFromCart = Joi.object({
  productId: mongoId.required().messages({ 'any.required': 'productId là bắt buộc' })
})

const removeManyFromCart = Joi.object({
  productIds: Joi.array()
    .items(mongoId.required())
    .min(1)
    .required()
    .messages({
      'array.min': 'Danh sách sản phẩm không được rỗng',
      'any.required': 'productIds là bắt buộc'
    })
})

module.exports = {
  addToCart,
  updateCart,
  removeFromCart,
  removeManyFromCart
}










