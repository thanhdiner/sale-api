const Joi = require('joi')

// ─────────────────────────────────────────────
// CONTACT FORM
// ─────────────────────────────────────────────

const sendContact = Joi.object({
  name: Joi.string().max(100).allow('', null).optional(),
  email: Joi.string().email({ tlds: { allow: false } }).required().messages({
    'string.email': 'Email không đúng định dạng',
    'any.required': 'Email là bắt buộc'
  }),
  subject: Joi.string().min(2).max(200).required().messages({
    'string.min': 'Chủ đề quá ngắn',
    'any.required': 'Chủ đề là bắt buộc'
  }),
  message: Joi.string().min(5).max(3000).required().messages({
    'string.min': 'Nội dung quá ngắn (tối thiểu 5 ký tự)',
    'any.required': 'Nội dung tin nhắn là bắt buộc'
  })
})

module.exports = { sendContact }










