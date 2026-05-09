const logger = require('../../../../../config/logger')
const cache = require('../../../../../config/redis')
const widgetRepository = require('../../../repositories/system/widget.repository')
const applyTranslation = require('../../../utils/applyTranslation')
const getRequestLanguage = require('../../../utils/getRequestLanguage')

const WIDGET_TRANSLATION_FIELDS = ['title']

//# GET /api/v1/widgets
module.exports.index = async (req, res) => {
  try {
    const language = getRequestLanguage(req)
    const result = await cache.getOrSet('widgets:active', async () => {
      const widgets = await widgetRepository.findAll({ isActive: true }, { sort: { order: 1 } })
      return { message: 'Widgets fetched successfully', data: widgets }
    }, 600)

    res.status(200).json({
      ...result,
      data: Array.isArray(result.data)
        ? result.data.map(widget => applyTranslation(widget, language, WIDGET_TRANSLATION_FIELDS))
        : []
    })
  } catch (err) {
    logger.error('[Client] Error fetching widgets:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}











