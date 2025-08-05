const FlashSale = require('../../models/flashSale.model')

function getRealStatus(fs) {
  const now = new Date()
  if (now < fs.startAt) return 'scheduled'
  if (now >= fs.startAt && now <= fs.endAt && fs.soldQuantity < fs.maxQuantity) return 'active'
  return 'completed'
}

//# GET /api/v1/client/flashsales?status=active
module.exports.index = async (req, res) => {
  try {
    const { status = 'active', page = 1, limit = 20 } = req.query
    const skip = (page - 1) * limit
    const flashSalesRaw = await FlashSale.find({}).populate('products').sort({ startAt: -1 }).skip(skip).limit(Number(limit))

    const flashSales = flashSalesRaw
      .map(fs => {
        const realStatus = getRealStatus(fs)
        return { ...fs.toObject(), status: realStatus }
      })
      .filter(fs => (status === 'all' ? true : fs.status === status))

    res.json({
      flashSales,
      total: flashSales.length,
      currentPage: Number(page),
      limit: Number(limit)
    })
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err })
  }
}

//# GET /api/v1/client/flashsales/:id
module.exports.detail = async (req, res) => {
  try {
    const flashSale = await FlashSale.findById(req.params.id).populate('products', 'name price thumbnail stock')

    if (!flashSale) return res.status(404).json({ message: 'Không tìm thấy flash sale' })

    const realStatus = getRealStatus(flashSale)

    res.json({
      flashSale: {
        ...flashSale.toObject(),
        status: realStatus
      }
    })
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err })
  }
}
