const Joi = require('joi')

const mongoId = Joi.string()
  .pattern(/^[a-f\d]{24}$/i)
  .messages({ 'string.pattern.base': 'ID không hợp lệ' })

// ─────────────────────────────────────────────
// FLASH SALE
// ─────────────────────────────────────────────

const flashSaleTranslationSchema = Joi.object({
  en: Joi.object({
    name: Joi.string().max(200).allow('', null)
  }).optional()
}).optional()

const createFlashSale = Joi.object({
  name: Joi.string().min(2).max(200).required().messages({
    'string.min': 'Tên flash sale quá ngắn',
    'any.required': 'Tên flash sale là bắt buộc'
  }),
  translations: flashSaleTranslationSchema,
  startAt: Joi.date().iso().required().messages({
    'date.iso': 'startAt phải là định dạng ISO date',
    'any.required': 'startAt là bắt buộc'
  }),
  endAt: Joi.date().iso().greater(Joi.ref('startAt')).required().messages({
    'date.greater': 'endAt phải sau startAt',
    'any.required': 'endAt là bắt buộc'
  }),
  discountPercent: Joi.number().min(1).max(100).required().messages({
    'number.min': 'Phần trăm giảm giá phải ít nhất 1%',
    'number.max': 'Phần trăm giảm giá tối đa 100%',
    'any.required': 'discountPercent là bắt buộc'
  }),
  maxQuantity: Joi.number().integer().min(1).required().messages({
    'number.min': 'maxQuantity phải ít nhất là 1',
    'any.required': 'maxQuantity là bắt buộc'
  }),
  products: Joi.array().items(mongoId.required()).min(1).required().messages({
    'array.min': 'Flash sale phải có ít nhất 1 sản phẩm',
    'any.required': 'Danh sách sản phẩm là bắt buộc'
  })
})

const editFlashSale = Joi.object({
  name: Joi.string().min(2).max(200).optional(),
  translations: flashSaleTranslationSchema,
  startAt: Joi.date().iso().optional(),
  endAt: Joi.date().iso().optional(),
  discountPercent: Joi.number().min(1).max(100).optional(),
  maxQuantity: Joi.number().integer().min(1).optional(),
  products: Joi.array().items(mongoId.required()).min(1).optional()
})

const changeFlashSaleStatus = Joi.object({
  status: Joi.string().valid('active', 'inactive', 'scheduled', 'completed').required().messages({
    'any.only': 'status không hợp lệ',
    'any.required': 'status là bắt buộc'
  })
})

const changeStatusMany = Joi.object({
  ids: Joi.array().items(mongoId.required()).min(1).required(),
  status: Joi.string().valid('active', 'inactive', 'scheduled', 'completed').required()
})

const deleteManyFlashSales = Joi.object({
  ids: Joi.array().items(mongoId.required()).min(1).required().messages({
    'array.min': 'Cần ít nhất 1 flash sale để xóa',
    'any.required': 'ids là bắt buộc'
  })
})

const changePositionMany = Joi.object({
  items: Joi.array().items(
    Joi.object({
      id: mongoId.required(),
      position: Joi.number().integer().min(0).required()
    })
  ).min(1).required()
})

module.exports = {
  createFlashSale,
  editFlashSale,
  changeFlashSaleStatus,
  changeStatusMany,
  deleteManyFlashSales,
  changePositionMany
}










