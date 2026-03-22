const Widget = require('../../models/widgets.model')
const logger = require('../../../../config/logger')

//# GET /api/v1/widgets
module.exports.index = async (req, res) => {
  try {
    const widgets = await Widget.find({ isActive: true }).sort({ order: 1 })

    res.status(200).json({
      message: 'Widgets fetched successfully',
      data: widgets
    })
  } catch (err) {
    logger.error('[Client] Error fetching widgets:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}
