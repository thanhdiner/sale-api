const logger = require('../../../../../config/logger')
const { generateProductContent } = require('../../../services/ai/content/productContentAssistant.service')

const normalizeText = value => (typeof value === 'string' ? value.trim() : '')

module.exports.generate = async (req, res, next) => {
  try {
    const data = await generateProductContent({
      action: req.body.action,
      target: req.body.target,
      product: req.body.product,
      language: req.body.language,
      provider: normalizeText(req.body.provider) || undefined,
      model: normalizeText(req.body.model) || undefined
    })

    return res.status(200).json({
      message: 'Product content generated successfully',
      data
    })
  } catch (error) {
    return next(error)
  }
}










