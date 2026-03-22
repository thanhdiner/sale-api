const Banner = require('../../models/banner.model')
const logger = require('../../../../config/logger')
const cache = require('../../../../config/redis')

//# GET /api/v1/banners
module.exports.index = async (req, res) => {
  try {
    const result = await cache.getOrSet('banners:active', async () => {
      const banners = await Banner.find({ isActive: true }).sort({ order: 1 })
      return { message: 'Banners fetched successfully', data: banners }
    }, 600) // 10 phút

    res.status(200).json(result)
  } catch (err) {
    logger.error('[Client] Error fetching banners:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}
