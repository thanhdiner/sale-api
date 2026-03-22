const Joi = require('joi')

const mongoId = Joi.string()
  .pattern(/^[a-f\d]{24}$/i)
  .messages({ 'string.pattern.base': 'ID không hợp lệ (phải là MongoDB ObjectId)' })

// ─────────────────────────────────────────────
// ORDER ITEM
// ─────────────────────────────────────────────
const orderItemSchema = Joi.object({
  productId: mongoId.required().messages({ 'any.required': 'productId là bắt buộc' }),
  name: Joi.string().max(255).optional(),
  image: Joi.string().uri().allow('', null).optional(),
  quantity: Joi.number().integer().min(1).max(9999).required().messages({
    'number.min': 'Số lượng phải ít nhất là 1',
    'any.required': 'quantity là bắt buộc'
  }),
  price: Joi.number().min(0).optional(),
  salePrice: Joi.number().min(0).optional(),
  isFlashSale: Joi.boolean().optional(),
  flashSaleId: mongoId.optional().allow('', null),
  discountPercentage: Joi.number().min(0).max(100).optional(),
  slug: Joi.string().optional()
})

// ─────────────────────────────────────────────
// CONTACT (SHIPPING INFO)
// ─────────────────────────────────────────────
const contactSchema = Joi.object({
  firstName: Joi.string().min(1).max(50).required().messages({
    'string.min': 'Tên không được để trống',
    'any.required': 'Tên là bắt buộc'
  }),
  lastName: Joi.string().min(1).max(50).required().messages({
    'string.min': 'Họ không được để trống',
    'any.required': 'Họ là bắt buộc'
  }),
  phone: Joi.string()
    .pattern(/^[0-9]{9,15}$/)
    .required()
    .messages({
      'string.pattern.base': 'Số điện thoại không hợp lệ',
      'any.required': 'Số điện thoại là bắt buộc'
    }),
  email: Joi.string().email({ tlds: { allow: false } }).allow('', null).optional(),
  address: Joi.string().min(5).max(500).required().messages({
    'string.min': 'Địa chỉ quá ngắn',
    'any.required': 'Địa chỉ là bắt buộc'
  }),
  city: Joi.string().min(1).max(100).optional().allow('', null),
  district: Joi.string().min(1).max(100).optional().allow('', null),
  ward: Joi.string().min(1).max(100).optional().allow('', null),
  note: Joi.string().max(500).allow('', null).optional(),
  userId: Joi.any().optional(),
  firstNameNoAccent: Joi.string().optional(),
  lastNameNoAccent: Joi.string().optional()
})

// ─────────────────────────────────────────────
// CREATE ORDER
// ─────────────────────────────────────────────
const createOrder = Joi.object({
  contact: contactSchema.required().messages({ 'any.required': 'Thông tin liên hệ là bắt buộc' }),
  orderItems: Joi.array().items(orderItemSchema).min(1).required().messages({
    'array.min': 'Đơn hàng phải có ít nhất 1 sản phẩm',
    'any.required': 'Danh sách sản phẩm là bắt buộc'
  }),
  deliveryMethod: Joi.string().valid('standard', 'express', 'pickup').default('standard'),
  paymentMethod: Joi.string().valid('cod', 'bank_transfer', 'online').default('cod'),
  subtotal: Joi.number().min(0).required().messages({ 'any.required': 'subtotal là bắt buộc' }),
  discount: Joi.number().min(0).default(0),
  shipping: Joi.number().min(0).default(0),
  total: Joi.number().min(0).required().messages({ 'any.required': 'total là bắt buộc' }),
  promo: Joi.alternatives().try(
    Joi.string().max(50),
    Joi.object({ code: Joi.string().max(50) })
  ).optional().allow('', null)
})

module.exports = {
  createOrder
}
