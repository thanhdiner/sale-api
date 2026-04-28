const logger = require('../../../../config/logger')
const homeWhyChooseUsContentService = require('../../services/client/homeWhyChooseUsContent.service')
const getRequestLanguage = require('../../utils/getRequestLanguage')

module.exports.index = async (req, res) => {
  try {
    const result = await homeWhyChooseUsContentService.getHomeWhyChooseUsContent(getRequestLanguage(req))
    res.status(200).json(result)
  } catch (err) {
    logger.error('[Client] Error fetching home why choose us content:', err)
    res.status(500).json({ error: 'Failed to fetch home why choose us content' })
  }
}
