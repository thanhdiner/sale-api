const mongoose = require('mongoose')
const AppError = require('../../utils/AppError')
const productRepository = require('../../repositories/product.repository')
const productCategoryRepository = require('../../repositories/productCategory.repository')
const cartRepository = require('../../repositories/cart.repository')
const wishlistRepository = require('../../repositories/wishlist.repository')
const productViewRepository = require('../../repositories/productView.repository')
const productsHelper = require('../../helpers/product')
const { getCheapDeals } = require('../../helpers/cheapDeals')
const applyTranslation = require('../../utils/applyTranslation')
const cache = require('../../../../config/redis')
const removeAccents = require('remove-accents')

const TTL_LIST = 180
const TTL_DETAIL = 300
const TTL_SUGGEST = 60
const SEARCH_SUGGESTION_PRODUCT_SELECT = 'title slug thumbnail price discountPercentage rate stock productCategory soldQuantity recommendScore position createdAt'
const PRODUCT_TRANSLATION_FIELDS = [
  'title',
  'description',
  'content',
  'features',
  'deliveryInstructions'
]

function normalizeLanguage(lang) {
  return String(lang || '').toLowerCase().startsWith('en') ? 'en' : 'vi'
}

function escapeRegex(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function normalizeSearchKeyword(value = '') {
  return removeAccents(String(value).replace(/\+/g, ' ').trim())
}

function localizeProduct(product, lang) {
  const localized = applyTranslation(product, normalizeLanguage(lang), PRODUCT_TRANSLATION_FIELDS)

  if (localized && product?.priceNew !== undefined && localized.priceNew === undefined) {
    localized.priceNew = product.priceNew
  }

  return localized
}

function localizeProductListResult(result, lang) {
  return {
    ...result,
    data: Array.isArray(result.data)
      ? result.data.map(product => localizeProduct(product, lang))
      : []
  }
}

function normalizeListParams(query = {}) {
  return {
    search: normalizeSearchKeyword(query.q || query.search || ''),
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
  if (params.search) query.titleNoAccent = { $regex: escapeRegex(params.search), $options: 'i' }
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
    case 'relevance':
      return { recommendScore: -1, soldQuantity: -1, viewsCount: -1, rate: -1, createdAt: -1 }
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

async function getProductsList(query = {}, lang = 'vi') {
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
    return localizeProductListResult(await fetchFn(), lang)
  }

  const result = await cache.getOrSet(cacheKey, fetchFn, TTL_LIST)
  return localizeProductListResult(result, lang)
}

async function getSuggestions(query = {}) {
  const queryStr = normalizeSearchKeyword(query.q || query.query || query.search || '')
  if (!queryStr.trim()) {
    return { suggestions: [] }
  }

  const limit = Math.min(parseInt(query.limit, 10) || 8, 12)
  const cacheKey = `products:suggest:${queryStr.toLowerCase()}:${limit}`

  return cache.getOrSet(cacheKey, async () => {
    const suggestions = await productRepository.findByQuery({
      titleNoAccent: { $regex: escapeRegex(queryStr), $options: 'i' },
      deleted: false,
      status: 'active',
      stock: { $gt: 0 }
    }, {
      sort: { soldQuantity: -1, recommendScore: -1, position: -1, createdAt: -1 },
      limit,
      select: 'title -_id'
    })

    return { suggestions: suggestions.map(item => item.title) }
  }, TTL_SUGGEST)
}

function normalizeSuggestionProduct(product) {
  const price = Number(product.price || 0)
  const discountPercentage = Number(product.discountPercentage || 0)
  const priceNew = Math.round((price * (100 - discountPercentage)) / 100)
  const category = product.productCategory && typeof product.productCategory === 'object'
    ? {
        id: product.productCategory._id?.toString(),
        title: product.productCategory.title,
        slug: product.productCategory.slug
      }
    : null

  return {
    id: product._id?.toString(),
    title: product.title,
    slug: product.slug,
    thumbnail: product.thumbnail,
    price,
    priceNew,
    discountPercentage,
    rate: product.rate,
    stock: product.stock,
    category
  }
}

function uniqueBy(items, getKey) {
  const seen = new Set()
  const result = []

  for (const item of items) {
    const key = getKey(item)
    if (!key || seen.has(key)) continue
    seen.add(key)
    result.push(item)
  }

  return result
}

async function getSearchSuggestions(query = {}) {
  const keyword = String(query.q || query.query || query.search || '').replace(/\+/g, ' ').trim()
  const normalizedKeyword = normalizeSearchKeyword(keyword)
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 6, 1), 10)

  if (!normalizedKeyword) {
    return {
      keyword,
      suggestions: [],
      categories: [],
      products: []
    }
  }

  const cacheKey = `products:search-suggestions:${normalizedKeyword.toLowerCase()}:${limit}`

  return cache.getOrSet(cacheKey, async () => {
    const regex = escapeRegex(normalizedKeyword)
    const categoryRegex = escapeRegex(keyword)

    const [products, matchedCategories] = await Promise.all([
      productRepository.findByQuery({
        titleNoAccent: { $regex: regex, $options: 'i' },
        deleted: false,
        status: 'active',
        stock: { $gt: 0 }
      }, {
        sort: { recommendScore: -1, soldQuantity: -1, viewsCount: -1, rate: -1, createdAt: -1 },
        limit,
        select: SEARCH_SUGGESTION_PRODUCT_SELECT,
        populate: { path: 'productCategory', select: 'title slug' },
        lean: true
      }),
      productCategoryRepository.findAll({
        title: { $regex: categoryRegex || regex, $options: 'i' },
        deleted: false,
        status: 'active'
      }, {
        sort: { position: -1, createdAt: -1 },
        limit: 4,
        select: 'title slug',
        lean: true
      })
    ])

    const productCategories = products
      .map(product => product.productCategory)
      .filter(category => category && typeof category === 'object')

    const categories = uniqueBy([...matchedCategories, ...productCategories], category => category._id?.toString())
      .slice(0, 4)
      .map(category => ({
        id: category._id?.toString(),
        title: category.title,
        slug: category.slug
      }))

    const suggestions = uniqueBy([
      ...products.map(product => product.title),
      ...categories.map(category => category.title)
    ], item => String(item || '').toLowerCase())
      .slice(0, 6)

    return {
      keyword,
      suggestions,
      categories,
      products: products.map(normalizeSuggestionProduct)
    }
  }, TTL_SUGGEST)
}

async function getProductDetail(slug, lang = 'vi') {
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

  return localizeProduct(result, lang)
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
  getSearchSuggestions,
  getProductDetail,
  getExploreMore,
  getRecommendations,
  trackProductView
}
