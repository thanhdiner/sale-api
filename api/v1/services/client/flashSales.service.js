const cache = require('../../../../config/redis')
const AppError = require('../../utils/AppError')
const flashSaleRepository = require('../../repositories/flashSale.repository')

function getRealStatus(flashSale) {
  const now = new Date()
  if (now < flashSale.startAt) return 'scheduled'
  if (now >= flashSale.startAt && now <= flashSale.endAt && flashSale.soldQuantity < flashSale.maxQuantity) return 'active'
  return 'completed'
}

async function listFlashSales(query = {}) {
  const { status = 'active', page = 1, limit = 20 } = query
  const cacheKey = `flashsales:list:${status}:${page}:${limit}`

  return cache.getOrSet(cacheKey, async () => {
    const skip = (Number(page) - 1) * Number(limit)
    const flashSalesRaw = await flashSaleRepository.findAll({}, {
      populate: {
        path: 'products',
        populate: {
          path: 'productCategory',
          select: 'title slug'
        }
      },
      sort: { startAt: -1 },
      skip,
      limit: Number(limit)
    })

    const flashSales = flashSalesRaw
      .map(flashSale => ({ ...flashSale.toObject(), status: getRealStatus(flashSale) }))
      .filter(flashSale => (status === 'all' ? true : flashSale.status === status))

    return {
      flashSales,
      total: flashSales.length,
      currentPage: Number(page),
      limit: Number(limit)
    }
  }, 120)
}

async function getFlashSaleDetail(id) {
  const cacheKey = `flashsales:detail:${id}`

  const result = await cache.getOrSet(cacheKey, async () => {
    const flashSale = await flashSaleRepository.findById(id, {
      populate: {
        path: 'products',
        select: 'title price thumbnail stock slug productCategory',
        populate: {
          path: 'productCategory',
          select: 'title slug'
        }
      }
    })

    if (!flashSale) return null
    return { flashSale: { ...flashSale.toObject(), status: getRealStatus(flashSale) } }
  }, 120)

  if (!result) {
    throw new AppError('Không tìm thấy flash sale', 404)
  }

  return result
}

module.exports = {
  listFlashSales,
  getFlashSaleDetail
}
