const mongoose = require('mongoose')
const AppError = require('../../utils/AppError')
const productRepository = require('../../repositories/product.repository')
const cartRepository = require('../../repositories/cart.repository')
const wishlistRepository = require('../../repositories/wishlist.repository')
const productViewRepository = require('../../repositories/productView.repository')
const productsHelper = require('../../helpers/product')
const { getCheapDeals } = require('../../helpers/cheapDeals')
const cache = require('../../../../config/redis')

const TTL_LIST = 180
const TTL_DETAIL = 300
const TTL_SUGGEST = 60

function normalizeListParams(query = {}) {
  return {
    search: (query.search || '').replace(/\+/g, ' '),
    sort: query.sort || 'newest',
    page: parseInt(query.page, 10) || 1,
    limit: parseInt(query.limit, 10) || 20,
    isTopDeal: query.isTopDeal || '',
    isFeatured: query.isFeatured || '',
    minPrice: parseFloat(query.minPrice) || 0,
    maxPrice: parseFloat(query.maxPrice) || 0,
    category: query.category || '',
    minRate: parseFloat(query.minRate) || 0,
    inStock: query.inStock || ''
  }
}

function hasAdvancedFilters(params) {
  return params.minPrice > 0 || params.maxPrice > 0 || params.category || params.minRate > 0 || params.inStock !== ''
}

function buildListQuery(params) {
  const query = {
    status: 'active',
    deleted: false
  }

  if (params.inStock === 'true') query.stock = { $gt: 0 }
  else if (params.inStock === 'false') query.stock = 0
  else query.stock = { $gt: 0 }

  if (params.isTopDeal === 'true') query.isTopDeal = true
  if (params.isFeatured === 'true') query.isFeatured = true
  if (params.search) query.titleNoAccent = { $regex: params.search, $options: 'i' }
  if (params.category) query.productCategory = params.category
  if (params.minRate > 0) query.rate = { $gte: params.minRate }

  if (params.minPrice > 0 || params.maxPrice > 0) {
    query.$expr = {
      $and: [
        ...(params.minPrice > 0 ? [{
          $gte: [
            { $subtract: ['$price', { $multiply: ['$price', { $divide: ['$discountPercentage', 100] }] }] },
            params.minPrice
          ]
        }] : []),
        ...(params.maxPrice > 0 ? [{
          $lte: [
            { $subtract: ['$price', { $multiply: ['$price', { $divide: ['$discountPercentage', 100] }] }] },
            params.maxPrice
          ]
        }] : [])
      ]
    }
  }

  return query
}

function getSortObject(sort) {
  switch (sort) {
    case 'price_asc':
      return { price: 1 }
    case 'price_desc':
      return { price: -1 }
    case 'name_asc':
      return { title: 1 }
    case 'name_desc':
      return { title: -1 }
    case 'sold_desc':
      return { soldQuantity: -1 }
    case 'rate_desc':
      return { rate: -1 }
    case 'newest':
    default:
      return { createdAt: -1 }
  }
}

function normalizeRecommendationParams(query = {}) {
  const allowedTabs = ['for-you', 'cheap-deals', 'newest']
  const tab = allowedTabs.includes(query.tab) ? query.tab : 'for-you'
  const limit = Math.min(parseInt(query.limit, 10) || 8, 20)
  const page = Math.max(parseInt(query.page, 10) || 1, 1)

  return {
    tab,
    limit,
    page,
    skip: (page - 1) * limit
  }
}

function getRecommendationBaseQuery() {
  return {
    status: 'active',
    deleted: false,
    stock: { $gt: 0 },
    thumbnail: { $exists: true, $nin: ['', null] }
  }
}

function normalizeProductIds(items = []) {
  return items.map(item => item.productId).filter(Boolean)
}

function deduplicateIds(ids = []) {
  return [...new Set(ids.map(String))]
}

function ensureValidObjectId(id, message = 'Product không hợp lệ') {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(message, 400)
  }
}

async function getProductsList(query = {}) {
  const params = normalizeListParams(query)
  const cacheKey = `products:list:${params.search}:${params.sort}:${params.page}:${params.limit}:${params.isTopDeal}:${params.isFeatured}`

  const fetchFn = async () => {
    const dbQuery = buildListQuery(params)
    const skip = (params.page - 1) * params.limit
    const [total, products] = await Promise.all([
      productRepository.countByQuery(dbQuery),
      productRepository.findByQuery(dbQuery, {
        sort: getSortObject(params.sort),
        skip,
        limit: params.limit
      })
    ])

    return {
      data: productsHelper.priceNewProducts(products),
      total
    }
  }

  if (hasAdvancedFilters(params)) {
    return fetchFn()
  }

  return cache.getOrSet(cacheKey, fetchFn, TTL_LIST)
}

async function getSuggestions(query = {}) {
  const queryStr = String(query.query || '').replace(/\+/g, ' ')
  if (!queryStr.trim()) {
    return { suggestions: [] }
  }

  const limit = parseInt(query.limit, 10) || 8
  const cacheKey = `products:suggest:${queryStr.toLowerCase()}:${limit}`

  return cache.getOrSet(cacheKey, async () => {
    const suggestions = await productRepository.findByQuery({
      titleNoAccent: { $regex: queryStr, $options: 'i' },
      deleted: false,
      status: 'active',
      stock: { $gt: 0 }
    }, {
      sort: { sold: -1, position: -1 },
      limit,
      select: 'title -_id'
    })

    return { suggestions: suggestions.map(item => item.title) }
  }, TTL_SUGGEST)
}

async function getProductDetail(slug) {
  const cacheKey = `products:detail:${slug}`

  const result = await cache.getOrSet(cacheKey, async () => {
    const product = await productRepository.findOneActiveBySlug(slug, {
      populate: 'productCategory'
    })

    if (!product) {
      return null
    }

    product.priceNew = productsHelper.priceNewProduct(product)
    return product.toObject ? { ...product.toObject(), priceNew: product.priceNew } : product
  }, TTL_DETAIL)

  if (!result) {
    throw new AppError('Không tìm thấy sản phẩm', 404)
  }

  return result
}

async function getExploreMore(productId, limitValue) {
  ensureValidObjectId(productId)

  const limit = Math.min(Number(limitValue) || 8, 20)
  const currentProduct = await productRepository.findActiveProductIdentity(productId)

  if (!currentProduct) {
    throw new AppError('Không tìm thấy sản phẩm', 404)
  }

  const cacheKey = `products:explore-more:${currentProduct._id}:${limit}`

  return cache.getOrSet(cacheKey, async () => {
    const sameCategoryProducts = await productRepository.findExploreMoreByCategory({
      currentProductId: currentProduct._id,
      categoryId: currentProduct.productCategory,
      limit
    })

    let products = sameCategoryProducts

    if (products.length < limit) {
      const fallbackProducts = await productRepository.findExploreMoreFallback({
        currentProductId: currentProduct._id,
        excludeIds: products.map(product => product._id),
        limit: limit - products.length
      })

      products = [...products, ...fallbackProducts]
    }

    return {
      products: productsHelper.priceNewProducts(products)
    }
  }, TTL_LIST)
}

async function getRecommendations({ user, query = {} }) {
  const { tab, limit, page, skip } = normalizeRecommendationParams(query)
  const isGuest = !user
  let recommendationQuery = getRecommendationBaseQuery()
  let sort = { recommendScore: -1 }

  if (tab === 'for-you') {
    let categoryIds = []

    if (!isGuest) {
      const userId = user.id
      const [cart, wishlist] = await Promise.all([
        cartRepository.findByUserId(userId),
        wishlistRepository.findByUserId(userId)
      ])

      let productIds = []
      if (cart?.items) {
        productIds = productIds.concat(normalizeProductIds(cart.items))
      }
      if (wishlist?.items) {
        productIds = productIds.concat(normalizeProductIds(wishlist.items))
      }

      const uniqueProductIds = deduplicateIds(productIds)
      if (uniqueProductIds.length > 0) {
        categoryIds = await productRepository.findDistinctCategoriesByIds(uniqueProductIds)
      }
    }

    if (categoryIds.length > 0) {
      recommendationQuery = {
        ...recommendationQuery,
        productCategory: { $in: categoryIds }
      }
    }
  } else if (tab === 'cheap-deals') {
    const fetchCheapDeals = async () => getCheapDeals(page, limit)

    if (isGuest) {
      return cache.getOrSet(`products:recommendations:cheap-deals-v2:${page}:${limit}`, fetchCheapDeals, TTL_LIST)
    }

    return fetchCheapDeals()
  } else if (tab === 'newest') {
    sort = { createdAt: -1 }
  }

  const fetchFn = async () => {
    const products = await productRepository.findByQuery(recommendationQuery, {
      sort,
      skip,
      limit
    })

    return {
      data: productsHelper.priceNewProducts(products),
      hasMore: products.length === limit
    }
  }

  if (isGuest) {
    return cache.getOrSet(`products:recommendations:${tab}:${page}:${limit}`, fetchFn, TTL_LIST)
  }

  return fetchFn()
}

async function trackProductView({ slug, user, ip }) {
  const product = await productRepository.findOneActiveBySlug(slug, { select: '_id' })
  if (!product) {
    throw new AppError('Sản phẩm không tồn tại', 404)
  }

  const productId = product._id.toString()
  const viewerKey = user ? `user:${user.id}` : `ip:${ip}`
  const redisKey = `view:${productId}:${viewerKey}`
  const redis = cache.getClient()

  try {
    const exists = await redis.get(redisKey)
    if (exists) {
      return { counted: false, reason: 'already_viewed_recently' }
    }
  } catch {
  }

  try {
    await redis.set(redisKey, '1', 'EX', 1800)
  } catch {
  }

  await productViewRepository.create({
    productId: product._id,
    viewerKey,
    viewedAt: new Date()
  })

  await productRepository.incrementViewsCount(product._id)

  return { counted: true }
}

module.exports = {
  getProductsList,
  getSuggestions,
  getProductDetail,
  getExploreMore,
  getRecommendations,
  trackProductView
}
