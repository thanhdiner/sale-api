const Joi = require('joi')

const mongoId = Joi.string()
  .pattern(/^[a-f\d]{24}$/i)
  .messages({ 'string.pattern.base': 'ID khong hop le (phai la MongoDB ObjectId)' })

const orderItemSchema = Joi.object({
  productId: mongoId.required().messages({ 'any.required': 'productId la bat buoc' }),
  name: Joi.string().max(255).optional(),
  image: Joi.string().uri().allow('', null).optional(),
  quantity: Joi.number().integer().min(1).max(9999).required().messages({
    'number.min': 'So luong phai it nhat la 1',
    'any.required': 'quantity la bat buoc'
  }),
  price: Joi.number().min(0).optional(),
  salePrice: Joi.number().min(0).optional(),
  isFlashSale: Joi.boolean().optional(),
  flashSaleId: mongoId.optional().allow('', null),
  discountPercentage: Joi.number().min(0).max(100).optional(),
  slug: Joi.string().optional()
})

const contactSchema = Joi.object({
  firstName: Joi.string().min(1).max(50).required().messages({
    'string.min': 'Ten khong duoc de trong',
    'any.required': 'Ten la bat buoc'
  }),
  lastName: Joi.string().min(1).max(50).required().messages({
    'string.min': 'Ho khong duoc de trong',
    'any.required': 'Ho la bat buoc'
  }),
  phone: Joi.string()
    .pattern(/^[0-9]{9,15}$/)
    .required()
    .messages({
      'string.pattern.base': 'So dien thoai khong hop le',
      'any.required': 'So dien thoai la bat buoc'
    }),
  email: Joi.string().email({ tlds: { allow: false } }).allow('', null).optional(),
  addressLine1: Joi.string().max(255).allow('', null).optional(),
  provinceCode: Joi.string().max(20).allow('', null).optional(),
  provinceName: Joi.string().max(120).allow('', null).optional(),
  districtCode: Joi.string().max(20).allow('', null).optional(),
  districtName: Joi.string().max(120).allow('', null).optional(),
  wardCode: Joi.string().max(20).allow('', null).optional(),
  wardName: Joi.string().max(120).allow('', null).optional(),
  address: Joi.string().min(5).max(500).allow('', null).optional().messages({
    'string.min': 'Dia chi qua ngan'
  }),
  notes: Joi.string().max(500).allow('', null).optional(),
  userId: Joi.any().optional(),
  firstNameNoAccent: Joi.string().optional(),
  lastNameNoAccent: Joi.string().optional()
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

const createOrder = Joi.object({
  contact: contactSchema.required().messages({ 'any.required': 'Thong tin lien he la bat buoc' }),
  orderItems: Joi.array().items(orderItemSchema).min(1).required().messages({
    'array.min': 'Don hang phai co it nhat 1 san pham',
    'any.required': 'Danh sach san pham la bat buoc'
  }),
  deliveryMethod: Joi.string().valid('pickup', 'contact').default('pickup'),
  paymentMethod: Joi.string().valid('transfer', 'contact', 'vnpay', 'momo', 'zalopay').default('transfer'),
  subtotal: Joi.number().min(0).required().messages({ 'any.required': 'subtotal la bat buoc' }),
  discount: Joi.number().min(0).default(0),
  shipping: Joi.number().min(0).default(0),
  total: Joi.number().min(0).required().messages({ 'any.required': 'total la bat buoc' }),
  promo: Joi.alternatives().try(
    Joi.string().max(50),
    Joi.object({ code: Joi.string().max(50) })
  ).optional().allow('', null)
})

module.exports = {
  createOrder
}
