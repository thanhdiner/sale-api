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
  const {
    status = 'active',
    page = 1,
    limit = 20,
    mode = 'campaign',
    category = ''
  } = query

  const currentPage = Math.max(Number(page) || 1, 1)
  const pageLimit = Math.max(Number(limit) || 20, 1)
  const cacheKey = `flashsales:list:${mode}:${status}:${category}:${currentPage}:${pageLimit}`

  return cache.getOrSet(cacheKey, async () => {
    const skip = (currentPage - 1) * pageLimit
    const populate = {
      path: 'products',
      populate: {
        path: 'productCategory',
        select: 'title slug'
      }
    }

    if (mode === 'product') {
      const flashSalesRaw = await flashSaleRepository.findAll({}, {
        populate,
        sort: { startAt: -1 }
      })

      const flashSales = flashSalesRaw
        .map(flashSale => ({ ...flashSale.toObject(), status: getRealStatus(flashSale) }))
        .filter(flashSale => (status === 'all' ? true : flashSale.status === status))

      const categoriesMap = new Map()
      const allItems = []

      flashSales.forEach(flashSale => {
        ;(flashSale.products || []).forEach(product => {
          const cat = product?.productCategory
          const categoryKey = cat?.slug || cat?._id?.toString()

          if (categoryKey && !categoriesMap.has(categoryKey)) {
            categoriesMap.set(categoryKey, {
              key: categoryKey,
              label: cat?.title || 'Chưa phân loại'
            })
          }

          const isCategoryMatched = !category || category === 'all'
            ? true
            : (cat?.slug === category || cat?._id?.toString() === category)

          if (!isCategoryMatched) return

          allItems.push({
            product,
            saleMeta: {
              flashSaleId: flashSale._id,
              name: flashSale.name,
              status: flashSale.status,
              discountPercent: flashSale.discountPercent,
              startAt: flashSale.startAt,
              endAt: flashSale.endAt,
              soldQuantity: flashSale.soldQuantity,
              maxQuantity: flashSale.maxQuantity
            }
          })
        })
      })

      const total = allItems.length
      const items = allItems.slice(skip, skip + pageLimit)

      return {
        items,
        categories: Array.from(categoriesMap.values()),
        total,
        currentPage,
        limit: pageLimit,
        hasMore: skip + pageLimit < total
      }
    }

    const total = await flashSaleRepository.countByQuery({})
    const flashSalesRaw = await flashSaleRepository.findAll({}, {
      populate,
      sort: { startAt: -1 },
      skip,
      limit: pageLimit
    })

    const flashSales = flashSalesRaw
      .map(flashSale => ({ ...flashSale.toObject(), status: getRealStatus(flashSale) }))
      .filter(flashSale => (status === 'all' ? true : flashSale.status === status))

    return {
      flashSales,
      total,
      currentPage,
      limit: pageLimit
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
