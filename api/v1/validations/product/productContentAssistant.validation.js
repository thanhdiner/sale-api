const Joi = require('joi')
const { ACTIONS, TARGETS } = require('../../services/ai/content/productContentAssistant.service')

const generate = Joi.object({
  action: Joi.string().valid(...ACTIONS).required(),
  target: Joi.string().valid(...TARGETS).required(),
  language: Joi.string().valid('vi', 'en').default('vi'),
  product: Joi.object().unknown(true).default({}),
  provider: Joi.string().allow('', null).optional(),
  model: Joi.string().allow('', null).optional()
})

module.exports = {
  generate
}










