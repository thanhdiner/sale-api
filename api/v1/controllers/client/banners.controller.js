const Banner = require('../../models/banner.model')

//# GET /api/v1/banners
module.exports.index = async (req, res) => {
  try {
    const banners = await Banner.find({ isActive: true }).sort({ order: 1 })

    res.status(200).json({
      message: 'Banners fetched successfully',
      data: banners
    })
  } catch (err) {
    console.error('Error fetching banners:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}
