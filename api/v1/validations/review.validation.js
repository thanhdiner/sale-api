const Joi = require('joi')

const createReview = Joi.object({
  rating: Joi.number().integer().min(1).max(5).required().messages({
    'number.min': 'Đánh giá phải từ 1 đến 5 sao',
    'number.max': 'Đánh giá phải từ 1 đến 5 sao',
    'number.integer': 'Đánh giá phải là số nguyên',
    'any.required': 'Đánh giá là bắt buộc'
  }),
  title: Joi.string().max(200).allow('', null).optional().messages({
    'string.max': 'Tiêu đề tối đa 200 ký tự'
  }),
  content: Joi.string().max(2000).allow('', null).optional().messages({
    'string.max': 'Nội dung đánh giá tối đa 2000 ký tự'
  })
})

const updateReview = Joi.object({
  rating: Joi.number().integer().min(1).max(5).required().messages({
    'number.min': 'Đánh giá phải từ 1 đến 5 sao',
    'number.max': 'Đánh giá phải từ 1 đến 5 sao',
    'number.integer': 'Đánh giá phải là số nguyên',
    'any.required': 'Đánh giá là bắt buộc'
  }),
  title: Joi.string().max(200).allow('', null).optional(),
  content: Joi.string().max(2000).allow('', null).optional(),
  keepImages: Joi.string().optional(),
  keepVideos: Joi.string().optional()
})

const getReviewsQuery = Joi.object({
  sort: Joi.string().valid('newest', 'helpful', 'highRating', 'lowRating').default('newest'),
  rating: Joi.number().integer().min(1).max(5).optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10)
})

module.exports = {
  createReview,
  updateReview,
  getReviewsQuery
}
