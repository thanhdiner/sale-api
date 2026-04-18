const FlashSale = require('../../models/flashSale.model')
const cache = require('../../../../config/redis')

function getRealStatus(fs) {
  const now = new Date()
  if (now < fs.startAt) return 'scheduled'
  if (now >= fs.startAt && now <= fs.endAt && fs.soldQuantity < fs.maxQuantity) return 'active'
  return 'completed'
}

//# GET /api/v1/flash-sales?status=active
module.exports.index = async (req, res) => {
  try {
    const { status = 'active', page = 1, limit = 20 } = req.query
    const cacheKey = `flashsales:list:${status}:${page}:${limit}`

    const result = await cache.getOrSet(
      cacheKey,
      async () => {
        const skip = (page - 1) * limit
        const flashSalesRaw = await FlashSale.find({}).populate('products').sort({ startAt: -1 }).skip(skip).limit(Number(limit))

        const flashSales = flashSalesRaw
          .map(fs => {
            const realStatus = getRealStatus(fs)
            return { ...fs.toObject(), status: realStatus }
          })
          .filter(fs => (status === 'all' ? true : fs.status === status))

        return {
          flashSales,
          total: flashSales.length,
          currentPage: Number(page),
          limit: Number(limit)
        }
      },
      120
    ) // 2 phút — flash sale có thể đổi trạng thái -> TTL ngắn

    res.json(result)
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err })
  }
}

//# GET /api/v1/flash-sales/:id
module.exports.detail = async (req, res) => {
  try {
    const { id } = req.params
    const cacheKey = `flashsales:detail:${id}`

    const result = await cache.getOrSet(
      cacheKey,
      async () => {
        const flashSale = await FlashSale.findById(id).populate('products', 'name price thumbnail stock')
        if (!flashSale) return null
        const realStatus = getRealStatus(flashSale)
        return { flashSale: { ...flashSale.toObject(), status: realStatus } }
      },
      120
    )

    if (!result) return res.status(404).json({ message: 'Không tìm thấy flash sale' })
    res.json(result)
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err })
  }
}
