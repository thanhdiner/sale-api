const Widget = require('../../models/widgets.model')
const logger = require('../../../../config/logger')
const cache = require('../../../../config/redis')

//# GET /api/v1/widgets
module.exports.index = async (req, res) => {
  try {
    const result = await cache.getOrSet('widgets:active', async () => {
      const widgets = await Widget.find({ isActive: true }).sort({ order: 1 })
      return { message: 'Widgets fetched successfully', data: widgets }
    }, 600) // 10 phút

    res.status(200).json(result)
  } catch (err) {
    logger.error('[Client] Error fetching widgets:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}
