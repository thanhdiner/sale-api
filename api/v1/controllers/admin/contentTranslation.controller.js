const logger = require('../../../../config/logger')
const { translateContentToEnglish } = require('../../services/ai/contentTranslation.service')

exports.translateToEnglish = async (req, res) => {
  try {
    const result = await translateContentToEnglish({
      target: req.body.target,
      payload: req.body.payload,
      provider: req.body.provider,
      model: req.body.model,
      maxTokens: req.body.maxTokens,
      temperature: req.body.temperature
    })
    res.status(200).json({ message: 'Content translated successfully', data: result.result, provider: result.provider, model: result.model })
  } catch (err) {
    logger.error('[Admin] Error translating content:', err)
    res.status(500).json({ error: err.message || 'Failed to translate content' })
  }
}
