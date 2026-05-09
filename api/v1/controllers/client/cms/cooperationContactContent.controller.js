const logger = require('../../../../../config/logger')
const cooperationContactContentService = require('../../../services/client/cms/cooperationContactContent.service')
const getRequestLanguage = require('../../../utils/getRequestLanguage')

module.exports.index = async (req, res) => {
  try {
    const result = await cooperationContactContentService.getCooperationContactContent(getRequestLanguage(req))
    res.status(200).json(result)
  } catch (err) {
    logger.error('[Client] Error fetching cooperation contact content:', err)
    res.status(500).json({ error: 'Failed to fetch cooperation contact content' })
  }
}










