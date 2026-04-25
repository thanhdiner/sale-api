const Joi = require('joi')

const mongoId = Joi.string()
  .pattern(/^[a-f\d]{24}$/i)
  .messages({ 'string.pattern.base': 'ID không hợp lệ' })

// ─────────────────────────────────────────────
// ADMIN PRODUCTS
// ─────────────────────────────────────────────

const createProduct = Joi.object({
  title: Joi.string().min(2).max(500).required().messages({
    'string.min': 'Tên sản phẩm phải có ít nhất 2 ký tự',
    'any.required': 'Tên sản phẩm là bắt buộc'
  }),
  slug: Joi.string().max(500).optional().allow('', null),
  description: Joi.string().max(50000).optional().allow('', null),
  content: Joi.string().max(50000).optional().allow('', null),
  price: Joi.number().min(0).required().messages({ 'any.required': 'Giá là bắt buộc' }),
  costPrice: Joi.number().min(0).optional().allow(null),
  discountPercentage: Joi.number().min(0).max(100).default(0),
  stock: Joi.number().integer().min(0).required().messages({ 'any.required': 'Kho hàng là bắt buộc' }),
  status: Joi.string().valid('active', 'inactive').default('active'),
  productCategory: mongoId.optional().allow('', null),
  thumbnail: Joi.string().uri().allow('', null).optional(),
  images: Joi.alternatives().try(
    Joi.array().items(Joi.string().uri()),
    Joi.string()
  ).optional(),
  features: Joi.alternatives().try(
    Joi.array().items(Joi.string()),
    Joi.string().allow('')
  ).optional().allow(null),
  isTopDeal: Joi.alternatives().try(Joi.boolean(), Joi.string()).optional(),
  isFeatured: Joi.alternatives().try(Joi.boolean(), Joi.string()).optional(),
  position: Joi.number().integer().min(0).optional(),
  deliveryEstimateDays: Joi.number().integer().min(0).optional().allow(null),
  deliveryType: Joi.string().valid('manual', 'instant_account').default('manual'),
  deliveryInstructions: Joi.string().max(5000).optional().allow('', null),
  timeStart: Joi.date().iso().optional().allow(null),
  timeFinish: Joi.date().iso().optional().allow(null)
})

const editProduct = createProduct
  .keys({
    existingImages: Joi.string().allow('', null).optional(),
    oldImages: Joi.string().allow('', null).optional(),
    deleteImages: Joi.string().allow('', null).optional()
  })
  .fork(
    ['title', 'price', 'stock'],
    schema => schema.optional()
  )

const changeStatusMany = Joi.object({
  ids: Joi.array().items(mongoId.required()).min(1).required().messages({
    'array.min': 'Cần ít nhất 1 sản phẩm',
    'any.required': 'ids là bắt buộc'
  }),
  status: Joi.string().valid('active', 'inactive').required().messages({
    'any.only': 'status phải là active hoặc inactive',
    'any.required': 'status là bắt buộc'
  })
})

const deleteMany = Joi.object({
  ids: Joi.array().items(mongoId.required()).min(1).required().messages({
    'array.min': 'Cần ít nhất 1 sản phẩm',
    'any.required': 'ids là bắt buộc'
  })
})

const changePositionMany = Joi.object({
  data: Joi.array().items(
    Joi.object({
      _id: mongoId.required(),
      position: Joi.number().integer().min(0).required()
    })
  ).min(1).required()
})

module.exports = {
  createProduct,
  editProduct,
  changeStatusMany,
  deleteMany,
  changePositionMany
}
