/**
 * AI tool executor implementations for the catalog domain.
 */

const {
  applyTranslation,
  backInStockService,
  BLOG_TRANSLATION_FIELDS,
  blogPostRepository,
  buildPromoPayload,
  calculateEffectiveProductPrice,
  cartRepository,
  checkPromoCode,
  cleanString,
  CLIENT_URL,
  clientProductService,
  clientReviewsService,
  COUPON_WALLET_PROMO_LOOKUP_LIMIT,
  DEFAULT_BLOG_POST_LIMIT,
  DEFAULT_BUYING_GUIDE_LIMIT,
  DEFAULT_COUPON_WALLET_EXPIRING_SOON_DAYS,
  DEFAULT_COUPON_WALLET_LIMIT,
  DEFAULT_SEARCH_PRODUCTS_LIMIT,
  escapeRegExp,
  excerptText,
  findAllDescendantIds,
  findProductByQuery,
  formatDate,
  formatOrderCode,
  formatPrice,
  getGuideLocalizedRoot,
  getGuideText,
  getOrderObject,
  getProductObject,
  hasOwnProperty,
  hasUserUsedPromo,
  isMongoObjectId,
  isPlainPolicyObject,
  isPromoExhausted,
  isPromoExpired,
  isSellableProduct,
  logger,
  LOYALTY_TIERS,
  LOYALTY_VND_PER_POINT,
  MAX_AVAILABILITY_PRODUCTS,
  MAX_BLOG_POST_LIMIT,
  MAX_BUYING_GUIDE_LIMIT,
  MAX_COMPARE_PRODUCTS,
  MAX_COUPON_WALLET_EXPIRING_SOON_DAYS,
  MAX_COUPON_WALLET_LIMIT,
  MAX_SEARCH_PRODUCTS_LIMIT,
  MIN_COMPARE_PRODUCTS,
  normalizeEnum,
  normalizeIntentText,
  normalizePolicyLanguage,
  normalizeQuantity,
  normalizeSearchTerms,
  normalizeSearchTermVariants,
  normalizeSearchText,
  normalizeSubtotal,
  normalizeUserId,
  orderRepository,
  pickString,
  productCategoryRepository,
  productRepository,
  productViewRepository,
  promoCodeRepository,
  removeAccents,
  reviewRepository,
  serializeDate,
  serializeId,
  toPlainObject,
  userRepository,
  vipContentService,
  websiteConfigRepository
} = require('./tool.helpers')

function normalizeSearchProductsArgs(args = {}) {
  args = args || {}

  let minPrice = normalizeSearchProductsPriceBound(args.minPrice)
  let maxPrice = normalizeSearchProductsPriceBound(args.maxPrice)

  if (minPrice != null && maxPrice != null && maxPrice < minPrice) {
    const nextMinPrice = maxPrice
    maxPrice = minPrice
    minPrice = nextMinPrice
  }

  return {
    keyword: cleanString(args.keyword || args.q || args.search),
    category: cleanString(args.category || args.categorySlug || args.categoryId),
    minPrice,
    maxPrice,
    minRating: normalizeSearchProductsRating(args.minRating ?? args.rating),
    inStock: normalizeSearchProductsBoolean(args.inStock ?? args.available ?? args.hasStock),
    sort: normalizeSearchProductsSort(args.sort),
    limit: normalizeSearchProductsLimit(args.limit)
  }
}

function normalizeSearchProductsNumber(value) {
  if (value === undefined || value === null || value === '') return null
  const normalized = Number(value)
  return Number.isFinite(normalized) && normalized >= 0 ? normalized : null
}

function normalizeSearchProductsPriceBound(value) {
  const normalized = normalizeSearchProductsNumber(value)
  return normalized > 0 ? normalized : null
}

function normalizeSearchProductsRating(value) {
  const normalized = normalizeSearchProductsNumber(value)
  if (normalized == null || normalized <= 0) return 0
  return Math.min(normalized, 5)
}

function normalizeSearchProductsBoolean(value) {
  if (value === undefined || value === null || value === '') return null
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') {
    if (value === 1) return true
    if (value === 0) return false
  }

  const normalized = normalizeIntentText(value).replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim()
  if (['true', '1', 'yes', 'y', 'con hang', 'available', 'in stock', 'instock'].includes(normalized)) return true
  if (['false', '0', 'no', 'n', 'het hang', 'out of stock', 'outstock', 'unavailable'].includes(normalized)) return false
  return null
}

function normalizeSearchProductsSort(sort) {
  const normalized = cleanString(sort).toLowerCase().replace(/[-\s]+/g, '_')
  const aliases = {
    popular: 'best_selling',
    bestseller: 'best_selling',
    best_seller: 'best_selling',
    best_selling: 'best_selling',
    sold: 'sold_desc',
    most_sold: 'sold_desc',
    price_low: 'price_asc',
    price_low_to_high: 'price_asc',
    cheapest: 'price_asc',
    price_high: 'price_desc',
    price_high_to_low: 'price_desc',
    highest_price: 'price_desc',
    rating: 'rating_desc',
    rate: 'rate_desc',
    discount: 'discount_desc',
    latest: 'newest',
    new: 'newest',
    name: 'name_asc'
  }
  const value = aliases[normalized] || normalized
  const allowed = new Set([
    'relevance',
    'best_selling',
    'sold_desc',
    'price_asc',
    'price_desc',
    'rating_desc',
    'rate_desc',
    'discount_desc',
    'newest',
    'name_asc',
    'name_desc'
  ])
  return allowed.has(value) ? value : 'best_selling'
}

function normalizeSearchProductsLimit(limit) {
  const normalized = Number(limit)
  if (!Number.isFinite(normalized) || normalized < 1) return DEFAULT_SEARCH_PRODUCTS_LIMIT
  return Math.min(Math.floor(normalized), MAX_SEARCH_PRODUCTS_LIMIT)
}

function applySearchProductsKeywordFilter(query, keyword) {
  const terms = buildSearchProductsKeywordTerms(keyword)
  if (terms.length === 0) return

  query.$and = terms.map(term => {
    const variants = [...new Set([
      ...normalizeSearchTermVariants(term),
      term,
      removeAccents(term)
    ].map(cleanString).filter(Boolean))]
    const conditions = variants.flatMap(variant => {
      const escaped = escapeRegExp(variant)
      return [
        { title: { $regex: escaped, $options: 'i' } },
        { titleNoAccent: { $regex: escaped, $options: 'i' } },
        { description: { $regex: escaped, $options: 'i' } },
        { content: { $regex: escaped, $options: 'i' } },
        { features: { $regex: escaped, $options: 'i' } },
        { 'translations.en.title': { $regex: escaped, $options: 'i' } },
        { 'translations.en.description': { $regex: escaped, $options: 'i' } },
        { 'translations.en.content': { $regex: escaped, $options: 'i' } }
      ]
    })

    return { $or: conditions }
  })
}

function buildSearchProductsKeywordTerms(keyword) {
  const rawKeyword = cleanString(keyword)
  if (!rawKeyword) return []

  const cleanedKeyword = normalizeSearchTerms(rawKeyword) || rawKeyword
  return cleanedKeyword.split(/\s+/).filter(Boolean)
}

function applySearchProductsRangeFilters(query, filters) {
  const priceConditions = []

  if (filters.minPrice != null && filters.minPrice > 0) {
    priceConditions.push({ $gte: [buildSearchProductsFinalPriceExpression(), filters.minPrice] })
  }

  if (filters.maxPrice != null) {
    priceConditions.push({ $lte: [buildSearchProductsFinalPriceExpression(), filters.maxPrice] })
  }

  if (priceConditions.length > 0) {
    query.$expr = { $and: priceConditions }
  }
}

function buildSearchProductsFinalPriceExpression() {
  return {
    $multiply: [
      { $ifNull: ['$price', 0] },
      {
        $subtract: [
          1,
          { $divide: [{ $ifNull: ['$discountPercentage', 0] }, 100] }
        ]
      }
    ]
  }
}

function buildSearchProductsPipeline(query, filters) {
  return [
    { $match: query },
    { $addFields: { finalPriceValue: buildSearchProductsFinalPriceExpression() } },
    { $sort: getSearchProductsSortObject(filters.sort) },
    { $limit: filters.limit },
    {
      $project: {
        title: 1,
        price: 1,
        discountPercentage: 1,
        stock: 1,
        thumbnail: 1,
        slug: 1,
        features: 1,
        rate: 1,
        soldQuantity: 1,
        productCategory: 1,
        finalPriceValue: 1
      }
    }
  ]
}

function getSearchProductsSortObject(sort) {
  switch (sort) {
    case 'price_asc':
      return { finalPriceValue: 1, soldQuantity: -1, _id: 1 }
    case 'price_desc':
      return { finalPriceValue: -1, soldQuantity: -1, _id: -1 }
    case 'rating_desc':
    case 'rate_desc':
      return { rate: -1, soldQuantity: -1, _id: -1 }
    case 'discount_desc':
      return { discountPercentage: -1, soldQuantity: -1, _id: -1 }
    case 'newest':
      return { createdAt: -1, _id: -1 }
    case 'name_asc':
      return { title: 1, _id: 1 }
    case 'name_desc':
      return { title: -1, _id: -1 }
    case 'relevance':
      return { recommendScore: -1, soldQuantity: -1, viewsCount: -1, rate: -1, createdAt: -1, _id: -1 }
    case 'sold_desc':
    case 'best_selling':
    default:
      return { soldQuantity: -1, recommendScore: -1, _id: -1 }
  }
}

async function resolveSearchProductCategoryFilter(category) {
  const rawCategory = cleanString(category)
  if (!rawCategory) return { categoryIds: [], matchedCategories: [] }

  const categories = await productCategoryRepository.findAll(
    { deleted: false, status: 'active' },
    { select: '_id title slug parent_id', lean: true }
  )
  const normalizedCategory = normalizeSearchProductsCategoryValue(rawCategory)
  const rawCategoryLower = rawCategory.toLowerCase()
  if (!normalizedCategory) return { categoryIds: [], matchedCategories: [] }
  const canPartialMatch = normalizedCategory.length >= 2

  const matchedCategories = categories.filter(item => {
    const id = item._id?.toString()
    const slug = cleanString(item.slug).toLowerCase()
    const normalizedTitle = normalizeSearchProductsCategoryValue(item.title)
    const normalizedSlug = normalizeSearchProductsCategoryValue(item.slug)

    return id === rawCategory
      || slug === rawCategoryLower
      || normalizedTitle === normalizedCategory
      || normalizedSlug === normalizedCategory
      || (canPartialMatch && normalizedTitle.includes(normalizedCategory))
      || (canPartialMatch && normalizedSlug.includes(normalizedCategory))
  })

  const categoryIdMap = new Map()
  matchedCategories.forEach(item => {
    findAllDescendantIds(categories, item._id).forEach(id => {
      categoryIdMap.set(id.toString(), id)
    })
  })

  return {
    categoryIds: [...categoryIdMap.values()],
    matchedCategories: matchedCategories.map(item => ({
      id: item._id?.toString(),
      title: item.title,
      slug: item.slug
    }))
  }
}

function normalizeSearchProductsCategoryValue(value) {
  return removeAccents(String(value || '').toLowerCase())
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function buildSearchProductsFilterSummary(filters, categoryFilter) {
  return {
    keyword: filters.keyword || null,
    category: filters.category || null,
    matchedCategories: categoryFilter.matchedCategories,
    minPrice: filters.minPrice,
    maxPrice: filters.maxPrice,
    minRating: filters.minRating || null,
    inStock: filters.inStock,
    sort: filters.sort,
    limit: filters.limit
  }
}

/**
 * Lấy chi tiết sản phẩm
 */

function normalizeProductAvailabilityInputs(args = {}) {
  const inputs = []
  const defaultQuantity = normalizeQuantity(args.quantity, 1)

  const appendInput = (input = {}) => {
    const productId = cleanString(input.productId || input.id)
    const productQuery = cleanString(
      input.productQuery
      || input.query
      || input.slug
      || input.name
      || input.title
    )
    const quantity = normalizeQuantity(input.quantity, defaultQuantity)

    if (!productId && !productQuery) return

    inputs.push({
      productId,
      productQuery,
      quantity,
      originalInput: cleanString(input.originalInput) || productQuery || productId
    })
  }

  const appendValue = (value, preferId = false) => {
    if (Array.isArray(value)) {
      value.forEach(item => appendValue(item, preferId))
      return
    }

    if (value && typeof value === 'object') {
      appendInput(value)
      return
    }

    const text = cleanString(value)
    if (!text) return

    splitCompareInputString(text).forEach(part => {
      appendInput({
        productId: preferId && isMongoObjectId(part) ? part : '',
        productQuery: !preferId || !isMongoObjectId(part) ? part : '',
        originalInput: part
      })
    })
  }

  appendValue(args.productId, true)
  appendValue(args.productQuery)
  appendValue(args.productName)
  appendValue(args.query)
  appendValue(args.slug)
  appendValue(args.name)
  appendValue(args.products)
  appendValue(args.items)
  appendValue(args.productIds, true)
  appendValue(args.productQueries)
  appendValue(args.productNames)
  appendValue(args.queries)
  appendValue(args.slugs)

  return inputs
}

async function resolveProductForAvailabilityInput({ productId, productQuery } = {}) {
  const normalizedProductId = cleanString(productId)

  if (isMongoObjectId(normalizedProductId)) {
    const product = await productRepository.findById(normalizedProductId, {
      populate: { path: 'productCategory', select: 'title' },
      lean: true
    })
    if (product) return product
  }

  return findProductByQuery(productQuery || normalizedProductId)
}

function buildProductAvailabilityPayload(product = {}, input = {}) {
  const stockQty = Math.max(0, Number(product.stock || 0))
  const requestedQuantity = normalizeQuantity(input.quantity, 1)
  const shortageQty = Math.max(0, requestedQuantity - stockQty)
  const inStock = stockQty > 0
  const canFulfillRequestedQuantity = inStock && shortageQty === 0
  const status = !inStock
    ? 'out_of_stock'
    : (canFulfillRequestedQuantity ? 'available' : 'insufficient_stock')
  const finalPrice = calculateEffectiveProductPrice(product)

  return {
    productId: product._id.toString(),
    name: product.title,
    slug: product.slug,
    category: product.productCategory?.title || null,
    requestedQuantity,
    stockQty,
    availableQuantity: stockQty,
    inStock,
    canFulfillRequestedQuantity,
    shortageQty,
    status,
    originalPrice: formatPrice(product.price),
    originalPriceValue: product.price,
    finalPrice: formatPrice(finalPrice),
    finalPriceValue: finalPrice,
    discount: product.discountPercentage ? `${product.discountPercentage}%` : null,
    url: product.slug ? `${CLIENT_URL}/products/${product.slug}` : null
  }
}

function buildProductAvailabilityMessage(products = [], unresolved = []) {
  if (products.length === 0) {
    return unresolved.length > 0
      ? 'Khong tim thay san pham hop le de kiem tra ton kho.'
      : 'Chua co san pham nao duoc kiem tra.'
  }

  const unavailableCount = products.filter(item => item.status !== 'available').length

  if (unavailableCount === 0 && unresolved.length === 0) {
    return products.length === 1
      ? 'San pham con du hang theo so luong yeu cau.'
      : 'Tat ca san pham deu con du hang theo so luong yeu cau.'
  }

  if (unavailableCount === 0) {
    return 'Cac san pham tim thay deu con du hang; mot so san pham khac khong tim thay hoac khong con ban.'
  }

  return 'Co san pham het hang hoac khong du so luong yeu cau.'
}

function getBackInStockEmail(args = {}, context = {}) {
  const contact = args.contact && typeof args.contact === 'object' ? args.contact : {}
  return pickString(args.email, contact.email, context.customerInfo?.email)
}

function buildBackInStockProductPayload(product = {}) {
  const stockQty = Math.max(0, Number(product.stock || 0))

  return {
    productId: product._id?.toString?.() || product.id || product.productId || null,
    name: product.title || product.name || null,
    slug: product.slug || null,
    stockQty,
    inStock: stockQty > 0,
    url: product.slug ? `${CLIENT_URL}/products/${product.slug}` : null
  }
}

function isUsableBackInStockProduct(product) {
  return !!product
    && product.deleted !== true
    && (product.status === 'active' || product.status == null)
    && (product._id || product.id || product.productId)
}

async function resolveBackInStockProduct(args = {}, context = {}) {
  const productId = cleanString(args.productId || args.id)
  const productQuery = cleanString(
    args.productQuery
    || args.productName
    || args.query
    || args.slug
    || args.name
  )

  if (productId || productQuery) {
    const product = await resolveProductForAvailabilityInput({ productId, productQuery })
    return isUsableBackInStockProduct(product) ? product : null
  }

  const currentPageProduct = await resolveCurrentPageProduct(context)
  return isUsableBackInStockProduct(currentPageProduct) ? currentPageProduct : null
}

function buildBackInStockToolError(error, fallbackMessage) {
  return {
    success: false,
    message: error?.message || fallbackMessage,
    requiresEmail: /email/i.test(error?.message || ''),
    error: 'BACK_IN_STOCK_REQUEST_FAILED'
  }
}

function normalizeProductAlternativesReason(reason) {
  const normalized = cleanString(reason).toLowerCase().replace(/[-\s]+/g, '_')
  const allowed = new Set(['out_of_stock', 'over_budget', 'insufficient_stock', 'general'])
  return allowed.has(normalized) ? normalized : 'general'
}

function normalizeProductAlternativeBudget(args = {}) {
  return normalizeSearchProductsNumber(
    args.budget
    ?? args.maxBudget
    ?? args.maxPrice
    ?? args.priceLimit
  )
}

function normalizeProductAlternativesArgs(args = {}) {
  return {
    productId: cleanString(args.productId || args.id),
    productQuery: cleanString(args.productQuery || args.query || args.slug || args.name || args.title),
    category: cleanString(args.category || args.categorySlug || args.categoryId),
    budget: normalizeProductAlternativeBudget(args),
    quantity: normalizeQuantity(args.quantity, 1) || 1,
    reason: normalizeProductAlternativesReason(args.reason),
    limit: normalizeToolLimit(args.limit, 5, 10)
  }
}

function getProductCategoryId(product = {}) {
  const category = product?.productCategory
  if (!category) return null
  if (typeof category === 'object') return category._id || null
  return category
}

function getProductCategoryTitle(product = {}) {
  const category = product?.productCategory
  return category && typeof category === 'object' ? category.title || null : null
}

function getProductAlternativeSourceStatus(product, { budget, quantity, reason } = {}) {
  if (!product) {
    return {
      found: false,
      requestedReason: reason,
      inStock: null,
      canFulfillRequestedQuantity: null,
      overBudget: budget != null ? null : false
    }
  }

  const stockQty = Math.max(0, Number(product.stock || 0))
  const finalPrice = getProductFinalPrice(product)
  const overBudget = budget != null && finalPrice > budget

  return {
    found: true,
    requestedReason: reason,
    stockQty,
    requestedQuantity: quantity,
    inStock: stockQty > 0,
    canFulfillRequestedQuantity: stockQty >= quantity,
    overBudget,
    finalPriceValue: finalPrice,
    finalPrice: formatPrice(finalPrice),
    budget,
    budgetFormatted: budget != null ? formatPrice(budget) : null
  }
}

function buildProductAlternativeQuery({
  categoryIds = [],
  excludeIds = [],
  keyword = '',
  quantity = 1
} = {}) {
  const query = {
    deleted: false,
    status: 'active',
    stock: { $gte: quantity }
  }

  const normalizedExcludeIds = excludeIds.filter(Boolean)
  if (normalizedExcludeIds.length > 0) {
    query._id = { $nin: normalizedExcludeIds }
  }

  if (categoryIds.length > 0) {
    query.productCategory = { $in: categoryIds }
  }

  applySearchProductsKeywordFilter(query, keyword)
  return query
}

async function fetchProductAlternativeCandidates({
  categoryIds = [],
  excludeIds = [],
  keyword = '',
  budget = null,
  quantity = 1,
  limit = 5,
  strategy = 'popular'
} = {}) {
  const query = buildProductAlternativeQuery({
    categoryIds,
    excludeIds,
    keyword,
    quantity
  })
  const pipeline = [
    { $match: query },
    { $addFields: { finalPriceValue: buildSearchProductsFinalPriceExpression() } },
    ...(budget != null ? [{ $match: { finalPriceValue: { $lte: budget } } }] : []),
    {
      $sort: {
        recommendScore: -1,
        soldQuantity: -1,
        rate: -1,
        finalPriceValue: 1,
        _id: 1
      }
    },
    { $limit: limit },
    {
      $lookup: {
        from: 'product_categories',
        localField: 'productCategory',
        foreignField: '_id',
        as: 'productCategory'
      }
    },
    {
      $unwind: {
        path: '$productCategory',
        preserveNullAndEmptyArrays: true
      }
    },
    {
      $project: {
        title: 1,
        price: 1,
        discountPercentage: 1,
        stock: 1,
        thumbnail: 1,
        slug: 1,
        rate: 1,
        soldQuantity: 1,
        recommendScore: 1,
        productCategory: {
          _id: '$productCategory._id',
          title: '$productCategory.title',
          slug: '$productCategory.slug'
        },
        finalPriceValue: 1
      }
    }
  ]

  const products = await productRepository.aggregate(pipeline)
  return products.map(product => ({ ...product, alternativeStrategy: strategy }))
}

function buildProductAlternativeStrategies({
  sourceProduct,
  explicitCategoryIds = [],
  budget,
  productQuery
} = {}) {
  const sourceCategoryId = getProductCategoryId(sourceProduct)
  const sourceCategoryIds = sourceCategoryId ? [sourceCategoryId] : []
  const preferredCategoryIds = explicitCategoryIds.length > 0 ? explicitCategoryIds : sourceCategoryIds
  const sourceKeyword = sourceProduct?.title || productQuery
  const strategies = []

  if (preferredCategoryIds.length > 0) {
    strategies.push({
      strategy: budget != null ? 'same_category_within_budget' : 'same_category',
      categoryIds: preferredCategoryIds,
      budget
    })
  }

  if (sourceKeyword) {
    strategies.push({
      strategy: budget != null ? 'similar_keyword_within_budget' : 'similar_keyword',
      keyword: sourceKeyword,
      budget
    })
  }

  if (budget != null) {
    strategies.push({
      strategy: 'within_budget',
      budget
    })
  }

  if (preferredCategoryIds.length > 0 && budget != null) {
    strategies.push({
      strategy: 'same_category_any_price',
      categoryIds: preferredCategoryIds,
      budget: null
    })
  }

  strategies.push({
    strategy: 'popular_in_stock',
    budget: null
  })

  return strategies
}

async function collectProductAlternatives({
  sourceProduct,
  explicitCategoryIds = [],
  productQuery,
  budget,
  quantity,
  limit
} = {}) {
  const alternatives = []
  const seenIds = new Set()
  const sourceId = sourceProduct?._id || null
  const excludeIds = sourceId ? [sourceId] : []
  const strategies = buildProductAlternativeStrategies({
    sourceProduct,
    explicitCategoryIds,
    budget,
    productQuery
  })

  for (const strategy of strategies) {
    if (alternatives.length >= limit) break

    const products = await fetchProductAlternativeCandidates({
      ...strategy,
      excludeIds: [...excludeIds, ...alternatives.map(product => product._id)],
      quantity,
      limit: limit - alternatives.length
    })

    for (const product of products) {
      const productId = product._id?.toString()
      if (!productId || seenIds.has(productId)) continue
      seenIds.add(productId)
      alternatives.push(product)
      if (alternatives.length >= limit) break
    }
  }

  return alternatives
}

function getProductAlternativeMatchReasons(product = {}, {
  sourceProduct,
  budget,
  quantity
} = {}) {
  const reasons = []
  const finalPrice = getProductFinalPrice(product)
  const sourceFinalPrice = sourceProduct ? getProductFinalPrice(sourceProduct) : null
  const productCategoryId = getProductCategoryId(product)?.toString?.()
  const sourceCategoryId = getProductCategoryId(sourceProduct)?.toString?.()

  if (Number(product.stock || 0) >= quantity) reasons.push('enough_stock')
  if (budget != null && finalPrice <= budget) reasons.push('within_budget')
  if (sourceFinalPrice != null && finalPrice < sourceFinalPrice) reasons.push('cheaper_than_source')
  if (productCategoryId && sourceCategoryId && productCategoryId === sourceCategoryId) {
    reasons.push('same_category')
  }
  if (product.alternativeStrategy) reasons.push(product.alternativeStrategy)

  return [...new Set(reasons)]
}

function buildProductAlternativePayload(product = {}, context = {}) {
  const finalPrice = getProductFinalPrice(product)
  const sourceFinalPrice = context.sourceProduct ? getProductFinalPrice(context.sourceProduct) : null
  const priceDeltaFromSource = sourceFinalPrice != null ? finalPrice - sourceFinalPrice : null

  return {
    ...buildCatalogProductPayload(product),
    category: getProductCategoryTitle(product),
    originalPriceValue: Number(product.price || 0),
    finalPriceValue: finalPrice,
    stockSufficient: Number(product.stock || 0) >= context.quantity,
    priceDeltaFromSource,
    priceDeltaFromSourceFormatted: priceDeltaFromSource != null ? formatPrice(priceDeltaFromSource) : null,
    matchReasons: getProductAlternativeMatchReasons(product, context)
  }
}

function buildProductAlternativesMessage({ sourceProduct, alternatives, budget, quantity } = {}) {
  if (alternatives.length === 0) {
    return sourceProduct
      ? 'Chua tim thay san pham thay the con du hang phu hop. Co the noi ngan sach hoac mo rong danh muc de minh tim tiep.'
      : 'Chua tim thay san pham thay the phu hop. Hay cho minh biet san pham, danh muc hoac ngan sach cu the hon.'
  }

  const status = getProductAlternativeSourceStatus(sourceProduct, { budget, quantity })
  if (!sourceProduct) return 'Da tim thay mot so san pham thay the phu hop voi dieu kien hien tai.'
  if (status.overBudget && !status.canFulfillRequestedQuantity) {
    return 'San pham goc vuot ngan sach hoac khong du hang; day la cac lua chon thay the phu hop hon.'
  }
  if (status.overBudget) return 'San pham goc vuot ngan sach; day la cac lua chon thay the uu tien trong ngan sach.'
  if (!status.canFulfillRequestedQuantity) return 'San pham goc het hang hoac khong du so luong; day la cac lua chon thay the con hang.'
  return 'Da tim thay mot so san pham thay the de khach so sanh them.'
}

function buildBlogTextFilter(value, fields = []) {
  const normalized = cleanString(value)
  if (!normalized) return null

  const regex = { $regex: escapeRegExp(normalized), $options: 'i' }
  return {
    $or: fields.map(field => ({ [field]: regex }))
  }
}

function buildBlogPostQuery({ query, category, tag } = {}) {
  const now = new Date()
  const filters = [
    {
      $or: [
        { publishedAt: { $lte: now } },
        { publishedAt: null }
      ]
    }
  ]

  const textFilter = buildBlogTextFilter(query, [
    'title',
    'excerpt',
    'content',
    'category',
    'tags',
    'translations.en.title',
    'translations.en.excerpt',
    'translations.en.content',
    'translations.en.category',
    'translations.en.tags'
  ])

  const categoryFilter = buildBlogTextFilter(category, [
    'category',
    'translations.en.category'
  ])

  const tagFilter = buildBlogTextFilter(tag, [
    'tags',
    'translations.en.tags'
  ])

  if (textFilter) filters.push(textFilter)
  if (categoryFilter) filters.push(categoryFilter)
  if (tagFilter) filters.push(tagFilter)

  return {
    isDeleted: false,
    status: 'published',
    $and: filters
  }
}

function normalizeBlogSort(sort, query) {
  const normalized = cleanString(sort).toLowerCase()
  if (['featured', 'newest', 'oldest', 'relevance'].includes(normalized)) return normalized
  return cleanString(query) ? 'relevance' : 'newest'
}

function getBlogSort(sort) {
  if (sort === 'featured') return { isFeatured: -1, publishedAt: -1, updatedAt: -1 }
  if (sort === 'oldest') return { publishedAt: 1, updatedAt: 1 }
  return { publishedAt: -1, updatedAt: -1 }
}

function stripContentMarkup(value = '') {
  return String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function scoreBlogPost(post = {}, query = '') {
  const normalizedQuery = normalizeSearchText(query)
  if (!normalizedQuery) return post.isFeatured ? 2 : 1

  const tags = Array.isArray(post.tags) ? post.tags.join(' ') : ''
  const haystack = normalizeSearchText(`${post.title} ${post.excerpt} ${post.content} ${post.category} ${tags}`)
  const terms = normalizedQuery.split(/\s+/).filter(term => term.length > 1)
  let score = haystack.includes(normalizedQuery) ? 20 : 0

  terms.forEach(term => {
    if (haystack.includes(term)) score += 1
  })

  if (normalizeSearchText(post.title).includes(normalizedQuery)) score += 8
  if (normalizeSearchText(tags).includes(normalizedQuery)) score += 4
  if (post.isFeatured) score += 2

  return score
}

function buildBlogPostPayload(rawPost = {}, language = 'vi', query = '') {
  const post = applyTranslation(rawPost, language, BLOG_TRANSLATION_FIELDS)
  const contentText = stripContentMarkup(post.content)
  const excerpt = stripContentMarkup(post.excerpt) || excerptText(contentText, 220)
  const slug = cleanString(post.slug)

  return {
    id: post._id?.toString?.() || post.id || null,
    title: cleanString(post.title) || 'Blog post',
    slug,
    category: cleanString(post.category) || null,
    tags: Array.isArray(post.tags) ? post.tags.map(tag => cleanString(tag)).filter(Boolean).slice(0, 8) : [],
    excerpt,
    contentSnippet: excerptText(contentText, 420),
    thumbnail: cleanString(post.thumbnail) || null,
    isFeatured: post.isFeatured === true,
    publishedAt: post.publishedAt || null,
    url: `${CLIENT_URL}/blog`,
    score: scoreBlogPost(post, query)
  }
}

function getGuideTextArray(value) {
  if (!Array.isArray(value)) return []
  return value.map(item => cleanString(item)).filter(Boolean)
}

function getGuideMergedList(config = {}, localizedRoot = {}, key) {
  const baseItems = Array.isArray(config[key]) ? config[key] : []
  const localizedItems = Array.isArray(localizedRoot[key]) ? localizedRoot[key] : []
  const total = Math.max(baseItems.length, localizedItems.length)

  return Array.from({ length: total }).map((_, index) => {
    const baseItem = baseItems[index]
    const localizedItem = localizedItems[index]

    if (isPlainPolicyObject(baseItem) || isPlainPolicyObject(localizedItem)) {
      return {
        ...(isPlainPolicyObject(baseItem) ? baseItem : {}),
        ...(isPlainPolicyObject(localizedItem) ? localizedItem : {})
      }
    }

    return pickString(localizedItem, baseItem)
  })
}

function addBuyingGuideEntry(entries, entry = {}) {
  const items = Array.isArray(entry.items)
    ? entry.items.map(item => stripContentMarkup(item)).filter(Boolean)
    : []
  const title = stripContentMarkup(entry.title)
  const text = stripContentMarkup(entry.text)

  if (!title && !text && items.length === 0) return

  entries.push({
    source: 'shoppingGuide',
    sourceLabel: 'Shopping guide',
    section: entry.section,
    type: entry.type || 'section',
    title: title || entry.section,
    text,
    items,
    url: `${CLIENT_URL}/shopping-guide`
  })
}

function buildBuyingGuideEntries(config = {}, language = 'vi') {
  const guide = toPlainObject(config)
  const localizedRoot = getGuideLocalizedRoot(guide, language)
  const entries = []

  addBuyingGuideEntry(entries, {
    section: 'overview',
    type: 'page',
    title: getGuideText(guide, localizedRoot, 'hero.title') || getGuideText(guide, localizedRoot, 'seo.title'),
    text: [
      getGuideText(guide, localizedRoot, 'hero.description'),
      getGuideText(guide, localizedRoot, 'seo.description')
    ].filter(Boolean).join(' ')
  })

  const steps = getGuideMergedList(guide, localizedRoot, 'steps')
    .map(step => `${cleanString(step.title)} ${cleanString(step.content)}`.trim())
    .filter(Boolean)
  addBuyingGuideEntry(entries, {
    section: 'steps',
    title: getGuideText(guide, localizedRoot, 'processSection.title'),
    text: getGuideText(guide, localizedRoot, 'processSection.eyebrow'),
    items: steps
  })

  getGuideMergedList(guide, localizedRoot, 'detailedSteps').forEach(step => {
    addBuyingGuideEntry(entries, {
      section: 'detailedSteps',
      title: cleanString(step.title) || cleanString(step.id),
      text: [
        step.description,
        ...getGuideTextArray(step.chips),
        ...getGuideTextArray(step.checks),
        step.note
      ].filter(Boolean).join(' ')
    })
  })

  const paymentMethods = getGuideMergedList(guide, localizedRoot, 'paymentMethods')
    .map(method => [
      method.name,
      method.desc,
      ...getGuideTextArray(method.badges)
    ].filter(Boolean).join(' '))
    .filter(Boolean)
  addBuyingGuideEntry(entries, {
    section: 'payment',
    title: getGuideText(guide, localizedRoot, 'paymentSection.title'),
    text: [
      getGuideText(guide, localizedRoot, 'paymentSection.description'),
      getGuideText(guide, localizedRoot, 'paymentSection.securityNote')
    ].filter(Boolean).join(' '),
    items: paymentMethods
  })

  getGuideMergedList(guide, localizedRoot, 'faq').forEach(item => {
    addBuyingGuideEntry(entries, {
      section: 'faq',
      type: 'faq',
      title: cleanString(item.question),
      text: item.answer
    })
  })

  addBuyingGuideEntry(entries, {
    section: 'tips',
    title: getGuideText(guide, localizedRoot, 'tipsSection.title'),
    text: getGuideText(guide, localizedRoot, 'tipsSection.description'),
    items: getGuideMergedList(guide, localizedRoot, 'smartTips')
  })

  addBuyingGuideEntry(entries, {
    section: 'support',
    title: getGuideText(guide, localizedRoot, 'supportSection.title'),
    text: [
      getGuideText(guide, localizedRoot, 'supportSection.description'),
      getGuideText(guide, localizedRoot, 'supportSection.workingTime')
    ].filter(Boolean).join(' ')
  })

  return entries
}

function normalizeBuyingGuideSection(section) {
  const normalized = cleanString(section).toLowerCase().replace(/[-_\s]+/g, '')
  const aliases = {
    overview: 'overview',
    hero: 'overview',
    intro: 'overview',
    step: 'steps',
    steps: 'steps',
    process: 'steps',
    detailed: 'detailedSteps',
    detailedstep: 'detailedSteps',
    detailedsteps: 'detailedSteps',
    payment: 'payment',
    payments: 'payment',
    checkout: 'payment',
    faq: 'faq',
    faqs: 'faq',
    tip: 'tips',
    tips: 'tips',
    support: 'support',
    contact: 'support'
  }

  return aliases[normalized] || null
}

function scoreBuyingGuideEntry(entry = {}, query = '') {
  const normalizedQuery = normalizeSearchText(query)
  if (!normalizedQuery) return 1

  const haystack = normalizeSearchText(`${entry.section} ${entry.title} ${entry.text} ${(entry.items || []).join(' ')}`)
  const terms = normalizedQuery.split(/\s+/).filter(term => term.length > 1)
  let score = haystack.includes(normalizedQuery) ? 20 : 0

  terms.forEach(term => {
    if (haystack.includes(term)) score += 1
  })

  if (normalizeSearchText(entry.title).includes(normalizedQuery)) score += 8
  return score
}

function buildBuyingGuidePayload(entry = {}, query = '') {
  return {
    source: entry.source,
    sourceLabel: entry.sourceLabel,
    section: entry.section,
    type: entry.type,
    title: entry.title,
    excerpt: excerptText(entry.text || entry.items.join(' '), 360),
    items: entry.items.slice(0, 6),
    url: entry.url,
    score: scoreBuyingGuideEntry(entry, query)
  }
}

function filterBuyingGuideEntries(entries = [], { query, section, limit } = {}) {
  const normalizedLimit = normalizeToolLimit(limit, DEFAULT_BUYING_GUIDE_LIMIT, MAX_BUYING_GUIDE_LIMIT)
  const normalizedSection = normalizeBuyingGuideSection(section)
  const normalizedQuery = cleanString(query)

  const filteredEntries = entries
    .filter(entry => !normalizedSection || entry.section === normalizedSection)
    .map(entry => ({ ...entry, score: scoreBuyingGuideEntry(entry, normalizedQuery) }))
    .filter(entry => !normalizedQuery || entry.score > 0)

  if (normalizedQuery) {
    filteredEntries.sort((left, right) => right.score - left.score)
  }

  return filteredEntries
    .slice(0, normalizedLimit)
    .map(entry => buildBuyingGuidePayload(entry, normalizedQuery))
}

function normalizeVipBoolean(value, fallback = true) {
  if (value === undefined || value === null || value === '') return fallback
  if (typeof value === 'boolean') return value

  const normalized = normalizeSearchText(value)
  if (['true', '1', 'yes', 'y', 'co', 'include'].includes(normalized)) return true
  if (['false', '0', 'no', 'n', 'khong', 'exclude'].includes(normalized)) return false

  return fallback
}

function buildVipUrl(value = '') {
  const url = cleanString(value)
  if (!url) return `${CLIENT_URL}/vip`
  if (url.startsWith('#')) return `${CLIENT_URL}/vip${url}`
  if (url.startsWith('/')) return `${CLIENT_URL}${url}`
  return url
}

function buildVipBenefitPayload(item = {}) {
  return {
    title: cleanString(item.title),
    description: excerptText(item.description, 260)
  }
}

function buildVipPlanPayload(plan = {}) {
  return {
    name: cleanString(plan.name),
    badge: cleanString(plan.badge) || null,
    price: cleanString(plan.price),
    period: cleanString(plan.period),
    description: excerptText(plan.description, 260),
    features: Array.isArray(plan.features)
      ? plan.features.map(feature => cleanString(feature)).filter(Boolean)
      : [],
    highlighted: plan.highlighted === true,
    ctaLabel: cleanString(plan.ctaLabel) || null,
    ctaUrl: buildVipUrl(plan.ctaLink)
  }
}

function buildVipComparisonPayload(row = {}) {
  return {
    benefit: cleanString(row.benefit),
    silver: cleanString(row.silver),
    gold: cleanString(row.gold),
    diamond: cleanString(row.diamond)
  }
}

function buildVipFaqPayload(item = {}) {
  return {
    question: cleanString(item.question),
    answer: excerptText(item.answer, 320)
  }
}

function hasVipContent(content = {}) {
  return Boolean(
    cleanString(content.hero?.title)
    || cleanString(content.seo?.title)
    || (Array.isArray(content.quickBenefits) && content.quickBenefits.length > 0)
    || (Array.isArray(content.benefits) && content.benefits.length > 0)
    || (Array.isArray(content.plans) && content.plans.length > 0)
    || (Array.isArray(content.comparisonRows) && content.comparisonRows.length > 0)
  )
}

function normalizeLoyaltyBoolean(value, fallback = false) {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (['true', '1', 'yes', 'y', 'co'].includes(normalized)) return true
    if (['false', '0', 'no', 'n', 'khong'].includes(normalized)) return false
  }
  return fallback
}

function normalizeLoyaltyPoints(value) {
  const points = Number(value)
  return Number.isFinite(points) && points >= 0 ? Math.floor(points) : null
}

function getStoredLoyaltyPoints(user = {}) {
  const source = toPlainObject(user)
  const candidates = [
    source.loyaltyPoints,
    source.rewardPoints,
    source.points,
    source.loyalty?.points,
    source.membership?.points,
    source.vip?.points
  ]

  for (const value of candidates) {
    const points = normalizeLoyaltyPoints(value)
    if (points !== null) return points
  }

  return null
}

function normalizeLoyaltyTierKey(value) {
  const normalized = removeAccents(cleanString(value).toLowerCase())
  if (!normalized) return ''

  if (['member', 'basic', 'standard', 'regular', 'thanh vien'].includes(normalized)) return 'member'
  if (['silver', 'bac'].includes(normalized)) return 'silver'
  if (['gold', 'vang'].includes(normalized)) return 'gold'
  if (['diamond', 'kim cuong'].includes(normalized)) return 'diamond'

  return LOYALTY_TIERS.some(tier => tier.key === normalized) ? normalized : ''
}

function getStoredLoyaltyTierKey(user = {}) {
  const source = toPlainObject(user)
  return normalizeLoyaltyTierKey(
    source.loyaltyTier
    || source.memberTier
    || source.membershipTier
    || source.vipTier
    || source.loyalty?.tier
    || source.membership?.tier
    || source.vip?.tier
  )
}

function getLoyaltyTierByKey(key) {
  return LOYALTY_TIERS.find(tier => tier.key === key) || null
}

function getLoyaltyTierForPoints(points) {
  const normalizedPoints = normalizeLoyaltyPoints(points) || 0
  return [...LOYALTY_TIERS]
    .reverse()
    .find(tier => normalizedPoints >= tier.minPoints) || LOYALTY_TIERS[0]
}

function getNextLoyaltyTier(currentTier) {
  const currentIndex = LOYALTY_TIERS.findIndex(tier => tier.key === currentTier?.key)
  if (currentIndex < 0 || currentIndex >= LOYALTY_TIERS.length - 1) return null
  return LOYALTY_TIERS[currentIndex + 1]
}

function getLoyaltyTierLabel(tier, language = 'vi') {
  if (!tier) return ''
  return language === 'en' ? tier.labelEn : tier.labelVi
}

function buildLoyaltyTierPayload(tier, language = 'vi') {
  if (!tier) return null
  return {
    key: tier.key,
    name: getLoyaltyTierLabel(tier, language),
    minPoints: tier.minPoints
  }
}

function calculateLoyaltyPointsFromSpend(spend) {
  return Math.floor(Math.max(Number(spend) || 0, 0) / LOYALTY_VND_PER_POINT)
}

function buildLoyaltyProgress(points, currentTier, language = 'vi') {
  const nextTier = getNextLoyaltyTier(currentTier)
  if (!nextTier) {
    return {
      isMaxTier: true,
      percent: 100,
      currentTierMinPoints: currentTier.minPoints,
      nextTier: null,
      pointsEarnedInTier: Math.max(points - currentTier.minPoints, 0),
      pointsNeededForTier: 0,
      pointsToNext: 0,
      spendToNext: 0,
      spendToNextFormatted: formatPrice(0)
    }
  }

  const pointsNeededForTier = Math.max(nextTier.minPoints - currentTier.minPoints, 1)
  const pointsEarnedInTier = Math.min(Math.max(points - currentTier.minPoints, 0), pointsNeededForTier)
  const pointsToNext = Math.max(nextTier.minPoints - points, 0)

  return {
    isMaxTier: false,
    percent: Math.round((pointsEarnedInTier / pointsNeededForTier) * 1000) / 10,
    currentTierMinPoints: currentTier.minPoints,
    nextTier: buildLoyaltyTierPayload(nextTier, language),
    pointsEarnedInTier,
    pointsNeededForTier,
    pointsToNext,
    spendToNext: pointsToNext * LOYALTY_VND_PER_POINT,
    spendToNextFormatted: formatPrice(pointsToNext * LOYALTY_VND_PER_POINT)
  }
}

function buildLoyaltyRecentOrderPayload(order = {}) {
  const source = getOrderObject(order)
  return {
    id: serializeId(source._id || source.id),
    code: formatOrderCode(source),
    total: Number(source.total || 0),
    totalFormatted: formatPrice(source.total || 0),
    completedAt: serializeDate(source.updatedAt || source.createdAt),
    createdAt: serializeDate(source.createdAt)
  }
}

function buildLoyaltyStatusMessage({ points, currentTier, progress, language }) {
  const currentTierName = getLoyaltyTierLabel(currentTier, language)
  if (progress.isMaxTier) {
    return language === 'en'
      ? `Customer has ${points} points and is currently ${currentTierName}, the highest tier.`
      : `Khach dang co ${points} diem va o hang ${currentTierName}, hang cao nhat hien tai.`
  }

  const nextTierName = progress.nextTier?.name || ''
  return language === 'en'
    ? `Customer has ${points} points, current tier is ${currentTierName}, and needs ${progress.pointsToNext} more points for ${nextTierName}.`
    : `Khach dang co ${points} diem, hang hien tai la ${currentTierName}, can them ${progress.pointsToNext} diem de len ${nextTierName}.`
}

async function resolveReviewProductInput({ productId, productQuery } = {}) {
  const normalizedProductId = cleanString(productId)
  if (isMongoObjectId(normalizedProductId)) {
    const product = await productRepository.findById(normalizedProductId, {
      populate: { path: 'productCategory', select: 'title' },
      lean: true
    })

    if (product && product.deleted !== true) return product
  }

  const lookup = cleanString(productQuery || normalizedProductId)
  return lookup ? findProductByQuery(lookup) : null
}

function buildReviewToolUser(context = {}) {
  const userId = normalizeUserId(context)
  if (!isMongoObjectId(userId)) return null

  return {
    userId,
    _id: userId,
    id: userId
  }
}

function buildReviewProductPayload(product = {}) {
  const source = toPlainObject(product)
  const productId = source._id?.toString?.() || source.id || source.productId || null
  const slug = source.slug || null

  return {
    productId,
    name: source.title || source.name || null,
    slug,
    category: source.productCategory?.title || null,
    url: slug ? `${CLIENT_URL}/products/${slug}` : null
  }
}

function buildReviewToolPayload(review = {}) {
  const source = toPlainObject(review)
  const reviewId = source._id?.toString?.() || source.id || source.reviewId || null
  const productId = source.productId?.toString?.() || String(source.productId || '')
  const author = source.userId && typeof source.userId === 'object'
    ? {
      name: source.userId.fullName || source.userId.username || 'Khach hang',
      username: source.userId.username || null
    }
    : null

  return {
    reviewId,
    productId,
    rating: source.rating,
    title: source.title || '',
    content: source.content || '',
    excerpt: excerptText(source.content),
    images: Array.isArray(source.images) ? source.images : [],
    videos: Array.isArray(source.videos) ? source.videos : [],
    helpfulCount: Number(source.helpfulCount || 0),
    isVoted: !!source.isVoted,
    isOwner: !!source.isOwner,
    canEdit: source.canEdit !== undefined ? !!source.canEdit : undefined,
    editsRemaining: source.editsRemaining,
    editCount: Number(source.editCount || 0),
    author,
    hasSellerReply: !!source.sellerReply?.content,
    sellerReply: source.sellerReply?.content
      ? {
        content: source.sellerReply.content,
        repliedAt: source.sellerReply.repliedAt || null
      }
      : null,
    hidden: !!source.hidden,
    createdAt: formatDate(source.createdAt),
    updatedAt: formatDate(source.updatedAt)
  }
}

function buildReviewViewerPayload(viewer = {}) {
  return {
    isLoggedIn: !!viewer.isLoggedIn,
    state: viewer.state || null,
    canCreate: !!viewer.canCreate,
    hasPurchased: !!viewer.hasPurchased,
    hasCompletedOrder: !!viewer.hasCompletedOrder,
    orderId: viewer.orderId?.toString?.() || (viewer.orderId ? String(viewer.orderId) : null),
    orderStatus: viewer.orderStatus || null,
    myReview: viewer.myReview ? buildReviewToolPayload(viewer.myReview) : null
  }
}

function normalizeReviewRatingInput(value) {
  const normalized = Number(value)
  if (!Number.isInteger(normalized) || normalized < 1 || normalized > 5) return null
  return normalized
}

function normalizeReviewTextField(args = {}, field, fallback = '', maxLength = 2000) {
  const hasField = hasOwnProperty(args, field)
  const value = hasField ? cleanString(args[field]) : cleanString(fallback)

  if (value.length > maxLength) {
    return {
      error: {
        success: false,
        message: `${field} toi da ${maxLength} ky tu.`
      }
    }
  }

  return { value }
}

function normalizeReviewMediaUrls(value, fallback = []) {
  if (Array.isArray(value)) {
    return value.map(item => cleanString(item)).filter(Boolean)
  }

  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) {
        return parsed.map(item => cleanString(item)).filter(Boolean)
      }
    } catch {
      return [value.trim()]
    }
  }

  return Array.isArray(fallback) ? fallback.map(item => cleanString(item)).filter(Boolean) : []
}

function normalizeCreateReviewBody(args = {}) {
  const rating = normalizeReviewRatingInput(args.rating)
  if (!rating) {
    return {
      error: {
        success: false,
        message: 'Vui long cung cap rating hop le tu 1 den 5 sao.'
      }
    }
  }

  const title = normalizeReviewTextField(args, 'title', '', 200)
  if (title.error) return title

  const content = normalizeReviewTextField(args, 'content', '', 2000)
  if (content.error) return content

  return {
    body: {
      rating,
      title: title.value,
      content: content.value
    }
  }
}

function normalizeUpdateReviewBody(args = {}, review = {}) {
  const source = toPlainObject(review)
  let rating = Number(source.rating || 0)

  if (hasOwnProperty(args, 'rating')) {
    rating = normalizeReviewRatingInput(args.rating)
    if (!rating) {
      return {
        error: {
          success: false,
          message: 'Vui long cung cap rating hop le tu 1 den 5 sao.'
        }
      }
    }
  }

  const title = normalizeReviewTextField(args, 'title', source.title || '', 200)
  if (title.error) return title

  const content = normalizeReviewTextField(args, 'content', source.content || '', 2000)
  if (content.error) return content

  const keepImages = normalizeReviewMediaUrls(
    hasOwnProperty(args, 'keepImages') ? args.keepImages : undefined,
    source.images
  )
  const keepVideos = normalizeReviewMediaUrls(
    hasOwnProperty(args, 'keepVideos') ? args.keepVideos : undefined,
    source.videos
  )

  return {
    body: {
      rating,
      title: title.value,
      content: content.value,
      keepImages: JSON.stringify(keepImages),
      keepVideos: JSON.stringify(keepVideos)
    }
  }
}

function buildReviewToolError(error, fallbackMessage) {
  return {
    success: false,
    message: error?.message || fallbackMessage,
    statusCode: error?.statusCode || null
  }
}

function getReviewOwnerId(review = {}) {
  const source = toPlainObject(review)
  const ownerId = source.userId?._id || source.userId
  return ownerId?.toString?.() || String(ownerId || '')
}

async function resolveOwnReviewForTool({ reviewId, productId, productQuery, userId } = {}) {
  const normalizedReviewId = cleanString(reviewId)

  if (normalizedReviewId) {
    if (!isMongoObjectId(normalizedReviewId)) {
      return {
        error: {
          success: false,
          message: 'reviewId khong hop le.'
        }
      }
    }

    const review = await reviewRepository.findOne({ _id: normalizedReviewId, deleted: false })
    if (!review) {
      return {
        error: {
          success: false,
          found: false,
          message: 'Khong tim thay danh gia can thao tac.'
        }
      }
    }

    if (getReviewOwnerId(review) !== String(userId)) {
      return {
        error: {
          success: false,
          message: 'Chi co the thao tac tren danh gia cua chinh ban.'
        }
      }
    }

    const product = await productRepository.findById(review.productId, {
      populate: { path: 'productCategory', select: 'title' },
      lean: true
    })

    return { review, product }
  }

  const product = await resolveReviewProductInput({ productId, productQuery })
  if (!product) {
    return {
      error: {
        success: false,
        found: false,
        message: `Khong tim thay san pham "${productQuery || productId || ''}".`
      }
    }
  }

  const review = await reviewRepository.findOne({
    productId: product._id,
    userId,
    deleted: false
  })

  if (!review) {
    return {
      error: {
        success: false,
        found: false,
        message: 'Khong tim thay danh gia cua ban cho san pham nay.'
      }
    }
  }

  return { review, product }
}

function splitCompareInputString(value = '') {
  const text = cleanString(value)
  if (!text) return []

  const parts = text
    .split(/\s+(?:vs\.?|versus|hay|hoặc|hoac|và|va)\s+|[,;|]+/i)
    .map(part => part.trim())
    .filter(Boolean)

  return parts.length > 1 ? parts : [text]
}

function normalizeCompareProductInputs(args = {}) {
  const inputs = []

  const appendInput = (input = {}) => {
    const productId = cleanString(input.productId)
    const productQuery = cleanString(
      input.productQuery
      || input.query
      || input.slug
      || input.name
      || input.title
    )

    if (!productId && !productQuery) return

    inputs.push({
      productId,
      productQuery,
      originalInput: cleanString(input.originalInput) || productQuery || productId
    })
  }

  const appendValue = (value, preferId = false) => {
    if (Array.isArray(value)) {
      value.forEach(item => appendValue(item, preferId))
      return
    }

    if (value && typeof value === 'object') {
      appendInput(value)
      return
    }

    const text = cleanString(value)
    if (!text) return

    splitCompareInputString(text).forEach(part => {
      appendInput({
        productId: preferId && isMongoObjectId(part) ? part : '',
        productQuery: !preferId || !isMongoObjectId(part) ? part : '',
        originalInput: part
      })
    })
  }

  appendValue(args.products)
  appendValue(args.items)
  appendValue(args.productIds, true)
  appendValue(args.productQueries)
  appendValue(args.productNames)
  appendValue(args.queries)
  appendValue(args.slugs)

  ;['productA', 'productB', 'productC', 'productD', 'a', 'b', 'c', 'd'].forEach(key => {
    appendValue(args[key])
  })

  return inputs
}

async function resolveProductForCompareInput({ productId, productQuery } = {}) {
  const normalizedProductId = cleanString(productId)
  if (isMongoObjectId(normalizedProductId)) {
    const product = await productRepository.findById(normalizedProductId, {
      populate: { path: 'productCategory', select: 'title' },
      lean: true
    })
    if (product) return product
  }

  return findProductByQuery(productQuery || normalizedProductId)
}

function normalizeFeatureList(features = []) {
  if (!Array.isArray(features)) return []

  return features
    .map(feature => cleanString(feature))
    .filter(Boolean)
}

function buildCompareProductPayload(product) {
  const originalPrice = Number(product.price || 0)
  const discountPercentage = Number(product.discountPercentage || 0)
  const finalPrice = calculateEffectiveProductPrice(product)
  const stockQty = Number(product.stock || 0)
  const savings = Math.max(originalPrice - finalPrice, 0)

  return {
    productId: product._id.toString(),
    name: product.title,
    slug: product.slug,
    category: product.productCategory?.title || null,
    originalPrice,
    originalPriceFormatted: formatPrice(originalPrice),
    finalPrice,
    finalPriceFormatted: formatPrice(finalPrice),
    discountPercentage,
    discount: discountPercentage > 0 ? `${discountPercentage}%` : null,
    savings,
    savingsFormatted: formatPrice(savings),
    stockQty,
    inStock: stockQty > 0,
    rating: product.rate || null,
    sold: Number(product.soldQuantity || 0),
    features: normalizeFeatureList(product.features).slice(0, 8),
    deliveryDays: product.deliveryEstimateDays || null,
    isTopDeal: !!product.isTopDeal,
    isFeatured: !!product.isFeatured,
    url: `${CLIENT_URL}/products/${product.slug}`
  }
}

function pickCompareProduct(products = [], selector, direction = 'max', { ignoreZero = false } = {}) {
  const candidates = products
    .map(product => ({
      product,
      value: Number(selector(product))
    }))
    .filter(item => Number.isFinite(item.value) && (!ignoreZero || item.value > 0))

  if (candidates.length === 0) return null

  candidates.sort((left, right) => (
    direction === 'min'
      ? left.value - right.value
      : right.value - left.value
  ))

  return candidates[0].product
}

function buildCompareReference(product, metric, value, valueFormatted = null) {
  if (!product) return null

  return {
    productId: product.productId,
    name: product.name,
    slug: product.slug,
    metric,
    value,
    valueFormatted,
    url: product.url
  }
}

function normalizeCompareFeature(value = '') {
  return removeAccents(cleanString(value).toLowerCase()).replace(/\s+/g, ' ')
}

function buildFeatureComparison(products = []) {
  const featureMap = new Map()

  products.forEach(product => {
    const seenForProduct = new Set()
    product.features.forEach(feature => {
      const key = normalizeCompareFeature(feature)
      if (!key || seenForProduct.has(key)) return

      seenForProduct.add(key)
      if (!featureMap.has(key)) {
        featureMap.set(key, {
          label: feature,
          productIds: new Set()
        })
      }
      featureMap.get(key).productIds.add(product.productId)
    })
  })

  const entries = Array.from(featureMap.values())
  const commonFeatures = entries
    .filter(entry => entry.productIds.size === products.length)
    .map(entry => entry.label)

  const uniqueFeatures = products.map(product => ({
    productId: product.productId,
    name: product.name,
    features: product.features.filter(feature => {
      const entry = featureMap.get(normalizeCompareFeature(feature))
      return entry?.productIds.size === 1
    })
  }))

  return {
    commonFeatures,
    uniqueFeatures
  }
}

function buildBestValueReasons(product, products = []) {
  const reasons = []
  const cheapest = pickCompareProduct(products, item => item.finalPrice, 'min')
  const highestRating = pickCompareProduct(products, item => item.rating || 0, 'max', { ignoreZero: true })
  const bestSeller = pickCompareProduct(products, item => item.sold || 0, 'max', { ignoreZero: true })
  const biggestDiscount = pickCompareProduct(products, item => item.discountPercentage || 0, 'max', { ignoreZero: true })

  if (cheapest?.productId === product.productId) reasons.push('Giá sau giảm thấp nhất')
  if (highestRating?.productId === product.productId) reasons.push('Rating cao nhất')
  if (bestSeller?.productId === product.productId) reasons.push('Lượt bán cao nhất')
  if (biggestDiscount?.productId === product.productId) reasons.push('Giảm giá sâu nhất')
  if (product.inStock) reasons.push('Còn hàng')

  return reasons.length > 0
    ? reasons.slice(0, 4)
    : ['Cân bằng tốt giữa giá, rating, lượt bán và tồn kho']
}

function pickBestValueCompareProduct(products = []) {
  const candidates = products.filter(product => product.inStock)
  const scoredCandidates = candidates.length > 0 ? candidates : products
  if (scoredCandidates.length === 0) return null

  const positivePrices = scoredCandidates.map(product => product.finalPrice).filter(price => price > 0)
  const minPrice = positivePrices.length > 0 ? Math.min(...positivePrices) : 0
  const maxSold = Math.max(...scoredCandidates.map(product => product.sold || 0), 0)
  const maxDiscount = Math.max(...scoredCandidates.map(product => product.discountPercentage || 0), 0)

  const scored = scoredCandidates.map(product => {
    const priceScore = minPrice > 0
      ? minPrice / Math.max(product.finalPrice || minPrice, minPrice)
      : 1
    const ratingScore = Number(product.rating || 0) / 5
    const soldScore = maxSold > 0 ? Number(product.sold || 0) / maxSold : 0
    const discountScore = maxDiscount > 0 ? Number(product.discountPercentage || 0) / maxDiscount : 0
    const stockScore = product.inStock ? 1 : 0
    const score = Math.round((
      priceScore * 0.35
      + ratingScore * 0.25
      + soldScore * 0.15
      + discountScore * 0.15
      + stockScore * 0.10
    ) * 100)

    return {
      ...buildCompareReference(product, 'bestValueScore', score, `${score}/100`),
      score,
      reasons: buildBestValueReasons(product, scoredCandidates)
    }
  })

  scored.sort((left, right) => right.score - left.score)
  return scored[0]
}

function buildCompareSummary(products = []) {
  const cheapest = pickCompareProduct(products, product => product.finalPrice, 'min')
  const highestRating = pickCompareProduct(products, product => product.rating || 0, 'max', { ignoreZero: true })
  const bestSeller = pickCompareProduct(products, product => product.sold || 0, 'max', { ignoreZero: true })
  const biggestDiscount = pickCompareProduct(products, product => product.discountPercentage || 0, 'max', { ignoreZero: true })
  const mostStock = pickCompareProduct(products, product => product.stockQty || 0, 'max', { ignoreZero: true })

  return {
    cheapest: buildCompareReference(
      cheapest,
      'finalPrice',
      cheapest?.finalPrice,
      cheapest?.finalPriceFormatted
    ),
    highestRating: buildCompareReference(
      highestRating,
      'rating',
      highestRating?.rating,
      highestRating?.rating ? `${highestRating.rating}/5` : null
    ),
    bestSeller: buildCompareReference(
      bestSeller,
      'sold',
      bestSeller?.sold,
      bestSeller ? `${bestSeller.sold}` : null
    ),
    biggestDiscount: buildCompareReference(
      biggestDiscount,
      'discountPercentage',
      biggestDiscount?.discountPercentage,
      biggestDiscount ? `${biggestDiscount.discountPercentage}%` : null
    ),
    mostStock: buildCompareReference(
      mostStock,
      'stockQty',
      mostStock?.stockQty,
      mostStock ? `${mostStock.stockQty}` : null
    ),
    bestValue: pickBestValueCompareProduct(products),
    featureComparison: buildFeatureComparison(products)
  }
}

function normalizeCouponWalletDays(value) {
  const normalized = Number(value)
  if (!Number.isInteger(normalized) || normalized < 1) {
    return DEFAULT_COUPON_WALLET_EXPIRING_SOON_DAYS
  }

  return Math.min(normalized, MAX_COUPON_WALLET_EXPIRING_SOON_DAYS)
}

function buildActivePromoWindowQuery(now = new Date()) {
  return {
    isActive: true,
    $and: [
      {
        $or: [
          { startsAt: { $exists: false } },
          { startsAt: null },
          { startsAt: { $lte: now } }
        ]
      },
      {
        $or: [
          { expiresAt: { $exists: false } },
          { expiresAt: null },
          { expiresAt: { $gte: now } }
        ]
      }
    ]
  }
}

function normalizeAudienceToken(value) {
  const raw = value == null
    ? ''
    : (typeof value === 'string' ? value : String(value))
  return removeAccents(raw.trim().toLowerCase()).replace(/\s+/g, ' ')
}

function addAudienceToken(tokens, value) {
  const normalized = normalizeAudienceToken(value)
  if (normalized) tokens.add(normalized)

  const digits = String(value || '').replace(/\D/g, '')
  if (digits) tokens.add(digits)
}

function addAudienceTokenValues(tokens, value) {
  if (Array.isArray(value)) {
    value.forEach(item => addAudienceTokenValues(tokens, item))
    return
  }

  if (typeof value === 'string' && value.includes(',')) {
    value.split(',').forEach(item => addAudienceToken(tokens, item))
    return
  }

  addAudienceToken(tokens, value)
}

function buildCustomerIdentityTokens({ userId, user = {}, customerInfo = {} } = {}) {
  const tokens = new Set()
  const sourceUser = user || {}
  const profile = sourceUser.checkoutProfile || {}

  addAudienceToken(tokens, userId)
  addAudienceToken(tokens, sourceUser._id)
  addAudienceToken(tokens, sourceUser.id)
  addAudienceToken(tokens, sourceUser.email)
  addAudienceToken(tokens, sourceUser.username)
  addAudienceToken(tokens, sourceUser.fullName)
  addAudienceToken(tokens, sourceUser.phone)
  addAudienceToken(tokens, profile.email)
  addAudienceToken(tokens, profile.phone)
  addAudienceToken(tokens, customerInfo.email)
  addAudienceToken(tokens, customerInfo.username)
  addAudienceToken(tokens, customerInfo.name)
  addAudienceToken(tokens, customerInfo.fullName)
  addAudienceToken(tokens, customerInfo.phone)

  return tokens
}

function buildCustomerGroupTokens({ user = {}, customerInfo = {} } = {}) {
  const tokens = new Set()
  const sourceUser = user || {}
  addAudienceTokenValues(tokens, sourceUser.customerGroups)
  addAudienceTokenValues(tokens, sourceUser.groups)
  addAudienceTokenValues(tokens, sourceUser.tags)
  addAudienceTokenValues(tokens, sourceUser.membershipTier)
  addAudienceTokenValues(tokens, sourceUser.membershipLevel)
  addAudienceTokenValues(tokens, customerInfo.customerGroups)
  addAudienceTokenValues(tokens, customerInfo.groups)
  addAudienceTokenValues(tokens, customerInfo.tags)
  addAudienceTokenValues(tokens, customerInfo.membershipTier)
  addAudienceTokenValues(tokens, customerInfo.membershipLevel)
  if (customerInfo.isVip === true) addAudienceToken(tokens, 'vip')

  return tokens
}

async function buildPromoCustomerContext(context = {}) {
  const userId = normalizeUserId(context)
  const customerInfo = context.customerInfo || {}
  const [user, orderCount] = await Promise.all([
    isMongoObjectId(userId)
      ? userRepository.findById(userId, {
          select: 'username email fullName phone checkoutProfile customerGroups groups tags membershipTier membershipLevel',
          lean: true
        })
      : null,
    isMongoObjectId(userId)
      ? orderRepository.countByQuery({ userId, isDeleted: false })
      : null
  ])

  return {
    userId,
    user,
    identityTokens: buildCustomerIdentityTokens({ userId, user, customerInfo }),
    groupTokens: buildCustomerGroupTokens({ user, customerInfo }),
    isNewCustomer: orderCount === 0
  }
}

function tokenListMatches(tokens, values = []) {
  if (!tokens?.size || !Array.isArray(values) || values.length === 0) return false
  return values.some(value => {
    const normalized = normalizeAudienceToken(value)
    const digits = String(value || '').replace(/\D/g, '')
    return (normalized && tokens.has(normalized)) || (digits && tokens.has(digits))
  })
}

function promoUserIdMatches(promo, userId) {
  return !!(promo?.userId && userId && String(promo.userId) === String(userId))
}

function promoSpecificCustomerMatches(promo, customer = {}) {
  return promoUserIdMatches(promo, customer.userId)
    || tokenListMatches(customer.identityTokens, promo?.specificCustomers)
}

function promoGroupMatches(promo, customer = {}) {
  return tokenListMatches(customer.groupTokens, promo?.customerGroups)
}

function hasSpecificCustomerRule(promo = {}) {
  return !!promo.userId
    || (Array.isArray(promo.specificCustomers) && promo.specificCustomers.length > 0)
}

function hasCustomerGroupRule(promo = {}) {
  return Array.isArray(promo.customerGroups) && promo.customerGroups.length > 0
}

function isPromoVisibleToCustomer(promo, customer = {}) {
  if (!promo) return false

  if (hasSpecificCustomerRule(promo)) {
    return promoSpecificCustomerMatches(promo, customer)
  }

  if (promo.audienceType === 'specific_customers') {
    return false
  }

  if (promo.newCustomersOnly || promo.audienceType === 'new_customers') {
    return customer.isNewCustomer === true
  }

  if (hasCustomerGroupRule(promo) || promo.audienceType === 'customer_groups') {
    return promoGroupMatches(promo, customer)
  }

  return true
}

function isPromoPrivateForCustomer(promo, customer = {}) {
  return hasSpecificCustomerRule(promo) && promoSpecificCustomerMatches(promo, customer)
}

function isPromoStarted(promo, now = new Date()) {
  return !(promo?.startsAt && new Date(promo.startsAt) > now)
}

function getPromoExpiresInDays(promo, now = new Date()) {
  if (!promo?.expiresAt) return null
  const expiresAt = new Date(promo.expiresAt)
  if (Number.isNaN(expiresAt.getTime())) return null
  return Math.ceil((expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
}

function getCouponWalletPromoStatus(promo, { now = new Date(), userId, customer } = {}) {
  if (!promo) return 'not_found'
  if (promo.isActive === false) return 'disabled'
  if (!isPromoStarted(promo, now)) return 'scheduled'
  if (isPromoExpired(promo, now)) return 'expired'
  if (isPromoExhausted(promo)) return 'exhausted'
  if (hasUserUsedPromo(promo, userId)) return 'used'
  if (customer && !isPromoVisibleToCustomer(promo, customer)) return 'not_applicable'
  return 'active'
}

function buildCouponWalletPromoPayload(promo, {
  subtotal = null,
  now = new Date(),
  userId = null,
  customer = null,
  expiringSoonDays = DEFAULT_COUPON_WALLET_EXPIRING_SOON_DAYS,
  source = null
} = {}) {
  const base = buildPromoPayload(promo, { subtotal })
  const status = getCouponWalletPromoStatus(promo, { now, userId, customer })
  const expiresInDays = getPromoExpiresInDays(promo, now)

  return {
    id: serializeId(promo._id || promo.id),
    title: cleanString(promo.title) || null,
    campaignDescription: cleanString(promo.description) || null,
    category: promo.category || 'all',
    audienceType: promo.audienceType || 'all_customers',
    startsAt: promo.startsAt || null,
    startsAtFormatted: promo.startsAt ? formatDate(promo.startsAt) : null,
    expiresInDays,
    isExpiringSoon: expiresInDays != null
      && expiresInDays >= 0
      && expiresInDays <= expiringSoonDays,
    isUsable: status === 'active',
    source,
    status,
    ...base,
    isPrivate: base.isPrivate || isPromoPrivateForCustomer(promo, customer || {})
  }
}

function dedupePromos(promos = []) {
  const seen = new Set()
  const result = []

  for (const promo of promos) {
    const key = serializeId(promo?._id || promo?.id) || cleanString(promo?.code).toUpperCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    result.push(promo)
  }

  return result
}

async function resolveSavedPromo(code, activePromos = []) {
  const normalizedCode = cleanString(code).toUpperCase()
  if (!normalizedCode) return null

  const activeMatch = activePromos.find(promo => cleanString(promo.code).toUpperCase() === normalizedCode)
  if (activeMatch) return activeMatch

  return promoCodeRepository.findOne({ code: normalizedCode }, { lean: true })
}

function normalizeToolLimit(limit, fallback = 5, max = 10) {
  const normalized = Number(limit)
  if (!Number.isInteger(normalized) || normalized < 1) return fallback
  return Math.min(normalized, max)
}

function normalizeToolPage(page) {
  const normalized = Number(page)
  if (!Number.isInteger(normalized) || normalized < 1) return 1
  return normalized
}

function normalizeRecommendationTab(tab) {
  return ['for-you', 'cheap-deals', 'newest'].includes(tab) ? tab : 'for-you'
}

function normalizeClientIp(value) {
  const raw = cleanString(value)
  if (!raw) return ''
  return raw.split(',')[0].trim()
}

function buildProductViewViewerKeys(context = {}) {
  const keys = []
  const userId = normalizeUserId(context)
  if (isMongoObjectId(userId)) keys.push(`user:${userId}`)

  const rawIp = normalizeClientIp(
    context.ip
    || context.clientIp
    || context.customerInfo?.ip
    || context.customerInfo?.clientIp
    || context.customerInfo?.requestIp
  )
  if (rawIp) {
    keys.push(`ip:${rawIp}`)
    if (rawIp.startsWith('::ffff:')) keys.push(`ip:${rawIp.replace(/^::ffff:/, '')}`)
  }

  return [...new Set(keys)]
}

function extractProductSlugFromPage(value = '') {
  const raw = cleanString(value)
  if (!raw) return ''

  let pathname = raw
  try {
    const parsed = new URL(raw, CLIENT_URL)
    pathname = parsed.pathname || raw
  } catch {
    pathname = raw.split(/[?#]/)[0]
  }

  const match = pathname.match(/\/products?\/([^/?#]+)/i)
  if (!match?.[1]) return ''

  try {
    return decodeURIComponent(match[1])
  } catch {
    return match[1]
  }
}

async function resolveCurrentPageProduct(context = {}) {
  const slug = extractProductSlugFromPage(context.customerInfo?.currentPage || context.currentPage)
  if (!slug) return null

  const product = await productRepository.findOneActiveBySlug(slug, {
    select: 'title slug thumbnail price discountPercentage stock soldQuantity rate deliveryEstimateDays viewsCount recommendScore',
    lean: true
  })

  return product || null
}

function buildRecentViewedProductPayload(view = {}) {
  const product = view.product || view
  return {
    ...buildCatalogProductPayload(product),
    viewedAt: view.viewedAt || null,
    viewedAtFormatted: view.viewedAt ? formatDate(view.viewedAt) : null,
    source: view.source || 'view_history',
    recommendationReason: view.source === 'current_page'
      ? 'Khach dang xem san pham nay.'
      : 'Khach vua xem san pham nay gan day.',
    deliveryEstimateDays: product.deliveryEstimateDays ?? null,
    viewsCount: product.viewsCount || 0,
    recommendScore: product.recommendScore || 0
  }
}

function getProductFinalPrice(product = {}) {
  const priceNew = Number(product.priceNew)
  if (Number.isFinite(priceNew) && priceNew >= 0) return Math.round(priceNew)
  return calculateEffectiveProductPrice(product)
}

function buildCatalogProductPayload(rawProduct = {}) {
  const product = getProductObject(rawProduct) || {}
  const productId = product._id?.toString() || product.id || product.productId || null
  const slug = product.slug || null
  const price = Number(product.price || 0)
  const finalPrice = getProductFinalPrice(product)
  const discountPercentage = Number(product.discountPercentage || 0)

  return {
    productId,
    name: product.title || product.name || null,
    slug,
    originalPrice: formatPrice(price),
    finalPrice: formatPrice(finalPrice),
    discount: discountPercentage > 0 ? `${discountPercentage}%` : null,
    inStock: Number(product.stock || 0) > 0,
    stockQty: Number(product.stock || 0),
    rating: product.rate || null,
    sold: product.soldQuantity || 0,
    thumbnail: product.thumbnail || null,
    url: slug ? `${CLIENT_URL}/products/${slug}` : null
  }
}

async function searchProducts(args = {}) {
  try {
    const filters = normalizeSearchProductsArgs(args)
    const categoryFilter = await resolveSearchProductCategoryFilter(filters.category)

    if (filters.category && categoryFilter.categoryIds.length === 0) {
      return JSON.stringify({
        found: false,
        filters: buildSearchProductsFilterSummary(filters, categoryFilter),
        message: `Khong tim thay danh muc "${filters.category}".`,
        suggestion: 'Thu dung ten danh muc, slug danh muc hoac bo loc category khac.'
      })
    }

    const query = {
      deleted: false,
      status: 'active'
    }

    applySearchProductsKeywordFilter(query, filters.keyword)
    applySearchProductsRangeFilters(query, filters)

    if (categoryFilter.categoryIds.length > 0) {
      query.productCategory = { $in: categoryFilter.categoryIds }
    }

    if (filters.inStock === true) query.stock = { $gt: 0 }
    if (filters.inStock === false) query.stock = { $lte: 0 }
    if (filters.minRating > 0) query.rate = { $gte: filters.minRating }

    const products = await productRepository.aggregate(buildSearchProductsPipeline(query, filters))

    if (products.length === 0) {
      if (filters.inStock === true) {
        const fallbackQuery = { ...query }
        delete fallbackQuery.stock

        const unavailableProducts = await productRepository.aggregate(buildSearchProductsPipeline(fallbackQuery, filters))

        if (unavailableProducts.length > 0) {
          return JSON.stringify({
            found: false,
            outOfStockOnly: true,
            filters: buildSearchProductsFilterSummary(filters, categoryFilter),
            message: 'Co san pham phu hop voi tu khoa nhung hien dang het hang.',
            suggestion: 'Goi y thong bao het hang ro rang va hoi khach co muon dang ky bao khi co hang lai hoac xem san pham AI/phan mem tuong tu.',
            unavailableProducts: unavailableProducts.map(buildCatalogProductPayload)
          })
        }
      }

      return JSON.stringify({
        found: false,
        filters: buildSearchProductsFilterSummary(filters, categoryFilter),
        message: 'Khong tim thay san pham nao phu hop voi bo loc.',
        suggestion: 'Thu noi khoang gia, giam rating toi thieu, bo loc ton kho hoac doi tu khoa.'
      })
    }

    const results = products.map(p => {
      const finalPrice = calculateEffectiveProductPrice(p)
      return {
        productId: p._id.toString(),
        name: p.title,
        slug: p.slug,
        originalPrice: formatPrice(p.price),
        originalPriceValue: p.price,
        discount: p.discountPercentage ? `${p.discountPercentage}%` : null,
        finalPrice: formatPrice(finalPrice),
        finalPriceValue: finalPrice,
        inStock: p.stock > 0,
        stockQty: p.stock,
        rating: p.rate || null,
        sold: p.soldQuantity || 0,
        url: `${CLIENT_URL}/products/${p.slug}`,
        features: (p.features || []).slice(0, 3)
      }
    })

    return JSON.stringify({
      found: true,
      count: results.length,
      filters: buildSearchProductsFilterSummary(filters, categoryFilter),
      products: results
    })
  } catch (err) {
    logger.error('[AI Tool] searchProducts error:', err.message)
    return JSON.stringify({ found: false, error: 'Loi khi tim kiem san pham. Vui long thu lai.' })
  }
}

async function getProductDetail({ slug }) {
  try {
    // 1. Tìm chính xác bằng slug
    let product = await productRepository.findOne(
      { slug, deleted: false },
      { populate: { path: 'productCategory', select: 'title' }, lean: true }
    )

    // 2. Fallback: tìm bằng regex exact title
    if (!product) {
      const escaped = slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      product = await productRepository.findOne({
        $or: [
          { title: { $regex: escaped, $options: 'i' } },
          { titleNoAccent: { $regex: escaped, $options: 'i' } }
        ],
        deleted: false
      }, {
        populate: { path: 'productCategory', select: 'title' },
        lean: true
      })
    }

    // 3. Fallback: fuzzy multi-word AND (giống searchProducts)
    if (!product) {
      let cleaned = slug
        .replace(/(tài khoản|acc|gói|mua|bán|giá rẻ|cần tìm|bản quyền|tháng|năm|nâng cấp|chính chủ)/gi, ' ')
        .replace(/chatgpt/gi, 'chat gpt')
        .replace(/canvapro/gi, 'canva pro')
        .trim()
      if (!cleaned) cleaned = slug
      const terms = cleaned.split(/\s+/).filter(t => t.length > 1)
      if (terms.length > 0) {
        const query = {
          deleted: false,
          $and: terms.map(term => {
            const esc = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            return {
              $or: [
                { title: { $regex: esc, $options: 'i' } },
                { titleNoAccent: { $regex: esc, $options: 'i' } }
              ]
            }
          })
        }
        product = await productRepository.findOne(query, {
          populate: { path: 'productCategory', select: 'title' },
          lean: true
        })
      }
    }

    if (!product) {
      return JSON.stringify({
        found: false,
        message: `Không tìm thấy sản phẩm "${slug}".`
      })
    }

    const finalPrice = product.discountPercentage
      ? Math.round(product.price * (1 - product.discountPercentage / 100))
      : product.price

    return JSON.stringify({
      found: true,
      product: {
        productId: product._id.toString(),
        name: product.title,
        category: product.productCategory?.title || 'Chưa phân loại',
        originalPrice: formatPrice(product.price),
        discount: product.discountPercentage ? `${product.discountPercentage}%` : null,
        finalPrice: formatPrice(finalPrice),
        inStock: product.stock > 0,
        stockQty: product.stock,
        description: product.description || 'Chưa có mô tả',
        features: product.features || [],
        rating: product.rate || null,
        sold: product.soldQuantity || 0,
        deliveryDays: product.deliveryEstimateDays || 'Liên hệ',
        url: `${CLIENT_URL}/products/${product.slug}`
      }
    })
  } catch (err) {
    logger.error('[AI Tool] getProductDetail error:', err.message)
    return JSON.stringify({ found: false, error: 'Lỗi khi lấy thông tin sản phẩm.' })
  }
}

async function checkProductAvailability(args = {}) {
  try {
    const requestedItems = normalizeProductAvailabilityInputs(args)

    if (requestedItems.length === 0) {
      return JSON.stringify({
        found: false,
        requiresProduct: true,
        message: 'Vui long cung cap san pham can kiem tra ton kho.'
      })
    }

    const selectedItems = requestedItems.slice(0, MAX_AVAILABILITY_PRODUCTS)
    const products = []
    const unresolved = []
    const seenProductIds = new Set()

    for (const item of selectedItems) {
      const product = await resolveProductForAvailabilityInput(item)

      if (!isSellableProduct(product)) {
        unresolved.push({
          input: item.originalInput,
          requestedQuantity: item.quantity,
          reason: 'not_found_or_unavailable'
        })
        continue
      }

      const productId = product._id.toString()
      if (seenProductIds.has(productId)) continue

      seenProductIds.add(productId)
      products.push(buildProductAvailabilityPayload(product, item))
    }

    const availableCount = products.filter(item => item.inStock).length
    const fulfillableCount = products.filter(item => item.canFulfillRequestedQuantity).length
    const outOfStockCount = products.filter(item => item.status === 'out_of_stock').length
    const insufficientStockCount = products.filter(item => item.status === 'insufficient_stock').length

    return JSON.stringify({
      found: products.length > 0,
      count: products.length,
      requestedCount: requestedItems.length,
      maxProducts: MAX_AVAILABILITY_PRODUCTS,
      truncated: requestedItems.length > MAX_AVAILABILITY_PRODUCTS,
      allInStock: products.length > 0 && availableCount === products.length,
      allAvailableForRequestedQuantity: products.length > 0 && fulfillableCount === products.length,
      summary: {
        availableCount,
        fulfillableCount,
        outOfStockCount,
        insufficientStockCount,
        unresolvedCount: unresolved.length
      },
      products,
      unresolved,
      message: buildProductAvailabilityMessage(products, unresolved)
    })
  } catch (err) {
    logger.error('[AI Tool] checkProductAvailability error:', err.message)
    return JSON.stringify({
      found: false,
      message: 'Khong the kiem tra ton kho luc nay.',
      error: 'Loi khi kiem tra ton kho san pham.'
    })
  }
}

async function getProductAlternatives(args = {}) {
  try {
    const params = normalizeProductAlternativesArgs(args)
    let sourceProduct = null

    if (params.productId || params.productQuery) {
      sourceProduct = await resolveProductForAvailabilityInput({
        productId: params.productId,
        productQuery: params.productQuery
      })
    }

    const explicitCategoryFilter = await resolveSearchProductCategoryFilter(params.category)
    const alternatives = await collectProductAlternatives({
      sourceProduct,
      explicitCategoryIds: explicitCategoryFilter.categoryIds,
      productQuery: params.productQuery,
      budget: params.budget,
      quantity: params.quantity,
      limit: params.limit
    })
    const sourceStatus = getProductAlternativeSourceStatus(sourceProduct, params)
    const products = alternatives.map(product => buildProductAlternativePayload(product, {
      sourceProduct,
      budget: params.budget,
      quantity: params.quantity
    }))

    return JSON.stringify({
      found: products.length > 0,
      count: products.length,
      reason: params.reason,
      budget: params.budget,
      budgetFormatted: params.budget != null ? formatPrice(params.budget) : null,
      requestedQuantity: params.quantity,
      sourceProduct: sourceProduct
        ? {
            ...buildCatalogProductPayload(sourceProduct),
            category: getProductCategoryTitle(sourceProduct),
            finalPriceValue: getProductFinalPrice(sourceProduct),
            status: sourceStatus
          }
        : null,
      sourceFound: Boolean(sourceProduct),
      matchedCategories: explicitCategoryFilter.matchedCategories,
      products,
      message: buildProductAlternativesMessage({
        sourceProduct,
        alternatives: products,
        budget: params.budget,
        quantity: params.quantity
      })
    })
  } catch (err) {
    logger.error('[AI Tool] getProductAlternatives error:', err.message)
    return JSON.stringify({
      found: false,
      message: 'Khong the lay san pham thay the luc nay.',
      error: 'Loi khi goi y san pham thay the.'
    })
  }
}

async function subscribeBackInStock(args = {}, context = {}) {
  try {
    const product = await resolveBackInStockProduct(args, context)
    if (!product) {
      return JSON.stringify({
        success: false,
        found: false,
        requiresProduct: true,
        message: 'Vui long cho minh biet san pham can dang ky bao khi co hang.'
      })
    }

    const userId = normalizeUserId(context)
    const result = await backInStockService.registerBackInStockNotification({
      productId: product._id?.toString?.() || product.id || product.productId,
      email: getBackInStockEmail(args, context),
      user: isMongoObjectId(userId) ? { userId } : null,
      lang: normalizePolicyLanguage(args.language, context)
    })

    return JSON.stringify({
      ...result,
      product: buildBackInStockProductPayload(product)
    })
  } catch (err) {
    logger.error('[AI Tool] subscribeBackInStock error:', err.message)
    return JSON.stringify(buildBackInStockToolError(err, 'Khong the dang ky bao khi co hang luc nay.'))
  }
}

async function unsubscribeBackInStock(args = {}, context = {}) {
  try {
    const product = await resolveBackInStockProduct(args, context)
    if (!product) {
      return JSON.stringify({
        success: false,
        found: false,
        requiresProduct: true,
        message: 'Vui long cho minh biet san pham can huy dang ky bao khi co hang.'
      })
    }

    const userId = normalizeUserId(context)
    const result = await backInStockService.unregisterBackInStockNotification({
      productId: product._id?.toString?.() || product.id || product.productId,
      email: getBackInStockEmail(args, context),
      user: isMongoObjectId(userId) ? { userId } : null,
      lang: normalizePolicyLanguage(args.language, context)
    })

    return JSON.stringify({
      ...result,
      product: buildBackInStockProductPayload(product)
    })
  } catch (err) {
    logger.error('[AI Tool] unsubscribeBackInStock error:', err.message)
    return JSON.stringify(buildBackInStockToolError(err, 'Khong the huy dang ky bao khi co hang luc nay.'))
  }
}

async function compareProducts(args = {}) {
  try {
    const requestedItems = normalizeCompareProductInputs(args)
    if (requestedItems.length < MIN_COMPARE_PRODUCTS) {
      return JSON.stringify({
        found: false,
        needsMoreProducts: true,
        minProducts: MIN_COMPARE_PRODUCTS,
        maxProducts: MAX_COMPARE_PRODUCTS,
        message: 'Cần ít nhất 2 sản phẩm để so sánh.'
      })
    }

    const selectedItems = requestedItems.slice(0, MAX_COMPARE_PRODUCTS)
    const resolvedProducts = []
    const unresolved = []
    const seenProductIds = new Set()

    for (const item of selectedItems) {
      const product = await resolveProductForCompareInput(item)

      if (!isSellableProduct(product)) {
        unresolved.push({
          input: item.originalInput,
          reason: 'not_found_or_unavailable'
        })
        continue
      }

      const productId = product._id.toString()
      if (seenProductIds.has(productId)) continue

      seenProductIds.add(productId)
      resolvedProducts.push(product)
    }

    if (resolvedProducts.length < MIN_COMPARE_PRODUCTS) {
      return JSON.stringify({
        found: false,
        needsMoreProducts: true,
        minProducts: MIN_COMPARE_PRODUCTS,
        maxProducts: MAX_COMPARE_PRODUCTS,
        resolvedCount: resolvedProducts.length,
        unresolved,
        message: 'Chưa xác định đủ 2 sản phẩm hợp lệ để so sánh.'
      })
    }

    const comparison = resolvedProducts.map(buildCompareProductPayload)

    return JSON.stringify({
      found: true,
      count: comparison.length,
      requestedCount: requestedItems.length,
      maxProducts: MAX_COMPARE_PRODUCTS,
      truncated: requestedItems.length > MAX_COMPARE_PRODUCTS,
      unresolved,
      comparison,
      summary: buildCompareSummary(comparison),
      note: unresolved.length > 0
        ? 'Một số sản phẩm không tìm thấy hoặc không còn bán nên không được đưa vào bảng so sánh.'
        : null
    })
  } catch (err) {
    logger.error('[AI Tool] compareProducts error:', err.message)
    return JSON.stringify({ found: false, error: 'Lỗi khi so sánh sản phẩm.' })
  }
}

/**
 * Kiểm tra trạng thái đơn hàng
 */

async function getFlashSales(args) {
  try {
    const maxLimit = 5

    // Lấy sản phẩm có discountPercentage > 0, ưu tiên giảm giá cao nhất
    const products = await productRepository.findByQuery({
      deleted: false,
      status: 'active',
      discountPercentage: { $gt: 0 },
      stock: { $gt: 0 }
    }, {
      select: 'title price discountPercentage stock thumbnail slug soldQuantity',
      sort: { discountPercentage: -1 },
      limit: maxLimit,
      lean: true
    })

    if (products.length === 0) {
      return JSON.stringify({
        found: false,
        message: 'Hiện tại không có chương trình giảm giá nào đang diễn ra.'
      })
    }

    const results = products.map(p => {
      const finalPrice = Math.round(p.price * (1 - p.discountPercentage / 100))
      return {
        productId: p._id.toString(),
        name: p.title,
        slug: p.slug,
        originalPrice: formatPrice(p.price),
        discount: `${p.discountPercentage}%`,
        salePrice: formatPrice(finalPrice),
        savings: formatPrice(p.price - finalPrice),
        url: `${CLIENT_URL}/products/${p.slug}`
      }
    })

    return JSON.stringify({
      found: true,
      count: results.length,
      deals: results
    })
  } catch (err) {
    logger.error('[AI Tool] getFlashSales error:', err.message)
    return JSON.stringify({ found: false, error: 'Lỗi khi lấy danh sách khuyến mãi.' })
  }
}

/**
 * Duyệt sản phẩm theo danh mục/chủ đề
 */

async function getAvailablePromoCodes({ subtotal } = {}, context = {}) {
  try {
    const normalizedSubtotal = normalizeSubtotal(subtotal)
    const userId = normalizeUserId(context)
    const now = new Date()

    const promoQuery = {
      isActive: true,
      $or: userId
        ? [{ userId: null }, { userId }]
        : [{ userId: null }]
    }

    const promos = await promoCodeRepository.findAll(promoQuery, {
      sort: { createdAt: -1 },
      limit: 20,
      lean: true
    })

    const visiblePromos = promos.filter(promo =>
      !isPromoExpired(promo, now)
      && !isPromoExhausted(promo)
      && !hasUserUsedPromo(promo, userId)
    )

    if (visiblePromos.length === 0) {
      return JSON.stringify({
        found: false,
        message: userId
          ? 'Hiện chưa có mã giảm giá khả dụng cho tài khoản này.'
          : 'Hiện chưa có mã giảm giá công khai nào đang hoạt động.',
        suggestion: 'Bạn có thể hỏi thêm về flash sale hoặc gửi mã cụ thể để mình kiểm tra.'
      })
    }

    const codes = visiblePromos
      .slice(0, 8)
      .map(promo => buildPromoPayload(promo, { subtotal: normalizedSubtotal }))

    const eligibleCount = codes.filter(code => code.eligible !== false).length
    const hasSubtotal = normalizedSubtotal !== null

    return JSON.stringify({
      found: true,
      count: codes.length,
      eligibleCount,
      subtotal: hasSubtotal ? normalizedSubtotal : null,
      message: hasSubtotal && eligibleCount === 0
        ? 'Có mã đang hoạt động nhưng chưa có mã nào áp dụng được cho giá trị đơn hiện tại.'
        : null,
      note: hasSubtotal
        ? null
        : 'Nếu bạn cho mình biết tổng tiền tạm tính, mình có thể lọc chính xác mã áp dụng được.',
      codes
    })
  } catch (err) {
    logger.error('[AI Tool] getAvailablePromoCodes error:', err.message)
    return JSON.stringify({ found: false, error: 'Lỗi khi lấy danh sách mã giảm giá.' })
  }
}

async function getCouponWallet({ subtotal, expiringSoonDays, limit } = {}, context = {}) {
  try {
    const userId = normalizeUserId(context)
    if (!isMongoObjectId(userId)) {
      return JSON.stringify({
        found: false,
        requiresLogin: true,
        message: 'Khach can dang nhap de xem vi ma giam gia.'
      })
    }

    const now = new Date()
    const normalizedSubtotal = normalizeSubtotal(subtotal)
    const days = normalizeCouponWalletDays(expiringSoonDays)
    const groupLimit = normalizeToolLimit(limit, DEFAULT_COUPON_WALLET_LIMIT, MAX_COUPON_WALLET_LIMIT)
    const expiringBefore = new Date(now.getTime() + days * 24 * 60 * 60 * 1000)
    const customer = await buildPromoCustomerContext(context)

    const [promos, cart] = await Promise.all([
      promoCodeRepository.findAll(buildActivePromoWindowQuery(now), {
        sort: { expiresAt: 1, createdAt: -1 },
        limit: COUPON_WALLET_PROMO_LOOKUP_LIMIT,
        lean: true
      }),
      cartRepository.findByUserId(userId, { lean: true })
    ])

    const savedCode = cleanString(cart?.promoCode).toUpperCase()
    const savedPromo = savedCode
      ? await resolveSavedPromo(savedCode, promos)
      : null
    const savedCodes = savedCode
      ? [
          savedPromo
            ? buildCouponWalletPromoPayload(savedPromo, {
                subtotal: normalizedSubtotal,
                now,
                userId,
                customer,
                expiringSoonDays: days,
                source: 'cart'
              })
            : {
                code: savedCode,
                source: 'cart',
                status: 'not_found',
                isUsable: false,
                message: 'Ma da luu trong gio hang khong con ton tai.'
              }
        ]
      : []

    const usablePromos = promos.filter(promo =>
      isPromoVisibleToCustomer(promo, customer)
      && !hasUserUsedPromo(promo, userId)
      && !isPromoExhausted(promo)
    )
    const privatePromos = usablePromos.filter(promo => isPromoPrivateForCustomer(promo, customer))
    const expiringSoonPromos = usablePromos.filter(promo => (
      promo.expiresAt
      && new Date(promo.expiresAt) >= now
      && new Date(promo.expiresAt) <= expiringBefore
    ))

    const privateCodes = dedupePromos(privatePromos)
      .slice(0, groupLimit)
      .map(promo => buildCouponWalletPromoPayload(promo, {
        subtotal: normalizedSubtotal,
        now,
        userId,
        customer,
        expiringSoonDays: days,
        source: 'private'
      }))
    const expiringSoonCodes = dedupePromos(expiringSoonPromos)
      .slice(0, groupLimit)
      .map(promo => buildCouponWalletPromoPayload(promo, {
        subtotal: normalizedSubtotal,
        now,
        userId,
        customer,
        expiringSoonDays: days,
        source: 'expiring_soon'
      }))

    return JSON.stringify({
      found: privateCodes.length > 0 || savedCodes.length > 0 || expiringSoonCodes.length > 0,
      expiringSoonDays: days,
      subtotal: normalizedSubtotal,
      subtotalFormatted: normalizedSubtotal == null ? null : formatPrice(normalizedSubtotal),
      counts: {
        private: privateCodes.length,
        saved: savedCodes.length,
        expiringSoon: expiringSoonCodes.length
      },
      privateCodes,
      savedCodes,
      expiringSoonCodes,
      message: privateCodes.length || savedCodes.length || expiringSoonCodes.length
        ? null
        : 'Chua co ma rieng, ma da luu hoac ma sap het han cho tai khoan nay.'
    })
  } catch (err) {
    logger.error('[AI Tool] getCouponWallet error:', err.message)
    return JSON.stringify({ found: false, error: 'Loi khi lay vi ma giam gia.' })
  }
}

async function getVipBenefits({ language, includePlans, includeFaqs } = {}, context = {}) {
  try {
    const normalizedLanguage = normalizePolicyLanguage(language, context)
    const shouldIncludePlans = normalizeVipBoolean(includePlans, true)
    const shouldIncludeFaqs = normalizeVipBoolean(includeFaqs, true)
    const result = await vipContentService.getVipContent(normalizedLanguage)
    const content = toPlainObject(result?.data || {})

    if (!hasVipContent(content)) {
      return JSON.stringify({
        found: false,
        language: normalizedLanguage,
        url: `${CLIENT_URL}/vip`,
        message: 'Chua co noi dung chuong trinh VIP duoc cau hinh.'
      })
    }

    const quickBenefits = (Array.isArray(content.quickBenefits) ? content.quickBenefits : [])
      .map(buildVipBenefitPayload)
      .filter(item => item.title || item.description)

    const benefits = (Array.isArray(content.benefits) ? content.benefits : [])
      .map(buildVipBenefitPayload)
      .filter(item => item.title || item.description)

    const plans = shouldIncludePlans
      ? (Array.isArray(content.plans) ? content.plans : [])
        .map(buildVipPlanPayload)
        .filter(plan => plan.name || plan.price || plan.features.length > 0)
      : []

    const comparisonRows = shouldIncludePlans
      ? (Array.isArray(content.comparisonRows) ? content.comparisonRows : [])
        .map(buildVipComparisonPayload)
        .filter(row => row.benefit || row.silver || row.gold || row.diamond)
      : []

    const faqs = shouldIncludeFaqs
      ? (Array.isArray(content.faqs) ? content.faqs : [])
        .map(buildVipFaqPayload)
        .filter(item => item.question || item.answer)
      : []

    const ctaLabel = cleanString(content.cta?.button) || cleanString(content.hero?.primaryButton)
    const ctaLink = cleanString(content.cta?.buttonLink) || cleanString(content.hero?.primaryButtonLink)

    return JSON.stringify({
      found: true,
      language: normalizedLanguage,
      url: `${CLIENT_URL}/vip`,
      title: cleanString(content.hero?.title) || cleanString(content.seo?.title) || 'VIP Membership',
      description: excerptText(content.hero?.description || content.seo?.description, 420),
      status: cleanString(content.hero?.status) || null,
      quickBenefits,
      benefits,
      plans,
      comparisonRows,
      faqs,
      cta: ctaLabel || ctaLink
        ? {
          label: ctaLabel || 'Dang ky VIP',
          url: buildVipUrl(ctaLink)
        }
        : null
    })
  } catch (err) {
    logger.error('[AI Tool] getVipBenefits error:', err.message)
    return JSON.stringify({ found: false, error: 'Loi khi lay noi dung VIP.' })
  }
}

async function getLoyaltyStatus({ language, includeRecentOrders } = {}, context = {}) {
  try {
    const userId = normalizeUserId(context)
    if (!isMongoObjectId(userId)) {
      return JSON.stringify({
        found: false,
        requiresLogin: true,
        message: 'Khach can dang nhap de xem diem va hang thanh vien.'
      })
    }

    const normalizedLanguage = normalizePolicyLanguage(language, context)
    const shouldIncludeRecentOrders = normalizeLoyaltyBoolean(includeRecentOrders, false)
    const user = await userRepository.findById(userId, {
      select: '_id username fullName email status loyalty loyaltyPoints rewardPoints points loyaltyTier memberTier membershipTier vipTier membership vip createdAt',
      lean: true
    })
    if (!user) {
      return JSON.stringify({
        found: false,
        message: 'Khong tim thay tai khoan khach hang.'
      })
    }

    const completedOrders = await orderRepository.findByQuery(
      { userId, isDeleted: false, status: 'completed' },
      {
        select: '_id orderCode total status paymentStatus createdAt updatedAt',
        sort: { createdAt: -1 },
        lean: true
      }
    )
    const eligibleSpend = completedOrders.reduce((sum, order) => sum + Math.max(Number(order.total) || 0, 0), 0)
    const estimatedPoints = calculateLoyaltyPointsFromSpend(eligibleSpend)
    const storedPoints = getStoredLoyaltyPoints(user)
    const points = storedPoints !== null ? storedPoints : estimatedPoints
    const storedTierKey = getStoredLoyaltyTierKey(user)
    const currentTier = getLoyaltyTierByKey(storedTierKey) || getLoyaltyTierForPoints(points)
    const progress = buildLoyaltyProgress(points, currentTier, normalizedLanguage)
    const lastEligibleOrder = completedOrders[0] || null

    return JSON.stringify({
      found: true,
      message: buildLoyaltyStatusMessage({ points, currentTier, progress, language: normalizedLanguage }),
      customer: {
        userId: serializeId(user._id),
        username: cleanString(user.username),
        fullName: cleanString(user.fullName),
        status: cleanString(user.status)
      },
      points: {
        current: points,
        formatted: normalizedLanguage === 'en' ? `${points} points` : `${points} diem`,
        source: storedPoints !== null ? 'user_profile' : 'completed_orders_estimate',
        estimatedFromCompletedOrders: estimatedPoints,
        storedPoints
      },
      tier: buildLoyaltyTierPayload(currentTier, normalizedLanguage),
      nextTier: progress.nextTier,
      progress,
      summary: {
        eligibleOrderStatus: 'completed',
        eligibleOrderCount: completedOrders.length,
        eligibleSpend,
        eligibleSpendFormatted: formatPrice(eligibleSpend),
        lastEligibleOrderAt: serializeDate(lastEligibleOrder?.updatedAt || lastEligibleOrder?.createdAt)
      },
      rules: {
        pointRate: {
          points: 1,
          spend: LOYALTY_VND_PER_POINT,
          spendFormatted: formatPrice(LOYALTY_VND_PER_POINT),
          currency: 'VND'
        },
        tiers: LOYALTY_TIERS.map(tier => buildLoyaltyTierPayload(tier, normalizedLanguage)),
        note: storedPoints !== null
          ? 'Diem lay tu ho so nguoi dung; don hoan thanh chi dung de tham chieu chi tieu.'
          : 'Chua co ledger diem rieng, diem duoc uoc tinh tu tong gia tri don hang hoan thanh.'
      },
      recentEligibleOrders: shouldIncludeRecentOrders
        ? completedOrders.slice(0, 3).map(buildLoyaltyRecentOrderPayload)
        : undefined
    })
  } catch (err) {
    logger.error('[AI Tool] getLoyaltyStatus error:', err.message)
    return JSON.stringify({ found: false, error: 'Loi khi lay trang thai thanh vien.' })
  }
}

async function searchBlogPosts({ query, category, tag, language, sort, limit } = {}, context = {}) {
  try {
    const normalizedLanguage = normalizePolicyLanguage(language, context)
    const normalizedLimit = normalizeToolLimit(limit, DEFAULT_BLOG_POST_LIMIT, MAX_BLOG_POST_LIMIT)
    const normalizedSort = normalizeBlogSort(sort, query)
    const findLimit = cleanString(query) || cleanString(category) || cleanString(tag)
      ? Math.min(normalizedLimit * 3, 30)
      : normalizedLimit

    const posts = await blogPostRepository.findByQuery(buildBlogPostQuery({ query, category, tag }), {
      sort: getBlogSort(normalizedSort),
      limit: findLimit,
      lean: true
    })

    const results = posts
      .map(post => buildBlogPostPayload(post, normalizedLanguage, query))
      .filter(post => normalizedSort !== 'relevance' || !cleanString(query) || post.score > 0)
      .sort((left, right) => {
        if (normalizedSort !== 'relevance') return 0
        return right.score - left.score
      })
      .slice(0, normalizedLimit)

    return JSON.stringify({
      found: results.length > 0,
      query: cleanString(query),
      category: cleanString(category) || null,
      tag: cleanString(tag) || null,
      language: normalizedLanguage,
      count: results.length,
      posts: results,
      message: results.length > 0
        ? null
        : 'Khong tim thay bai blog phu hop voi yeu cau nay.'
    })
  } catch (err) {
    logger.error('[AI Tool] searchBlogPosts error:', err.message)
    return JSON.stringify({ found: false, error: 'Loi khi tim bai viet blog.' })
  }
}

async function getBuyingGuides({ query, topic, section, language, limit } = {}, context = {}) {
  try {
    const normalizedLanguage = normalizePolicyLanguage(language, context)
    const websiteConfig = await websiteConfigRepository.findOne({}, { lean: true })
    const shoppingGuide = websiteConfig?.shoppingGuide || {}
    const entries = buildBuyingGuideEntries(shoppingGuide, normalizedLanguage)
    const searchQuery = cleanString(query || topic)
    const results = filterBuyingGuideEntries(entries, {
      query: searchQuery,
      section,
      limit
    })

    return JSON.stringify({
      found: results.length > 0,
      query: searchQuery,
      section: normalizeBuyingGuideSection(section),
      language: normalizedLanguage,
      url: `${CLIENT_URL}/shopping-guide`,
      count: results.length,
      guides: results,
      message: results.length > 0
        ? null
        : 'Chua co noi dung huong dan mua hang phu hop.'
    })
  } catch (err) {
    logger.error('[AI Tool] getBuyingGuides error:', err.message)
    return JSON.stringify({ found: false, error: 'Loi khi lay huong dan mua hang.' })
  }
}

async function browseByCategory({ categoryKeyword }) {
  try {
    const keyword = (categoryKeyword || '').trim()
    if (!keyword) {
      return JSON.stringify({ found: false, message: 'Vui lòng cho mình biết bạn quan tâm đến lĩnh vực nào?' })
    }

    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

    // Tìm danh mục khớp keyword
    const categories = await productCategoryRepository.findAll({
      $or: [
        { title: { $regex: escaped, $options: 'i' } },
        { description: { $regex: escaped, $options: 'i' } }
      ],
      deleted: false
    }, {
      select: '_id title slug',
      lean: true
    })

    let products = []

    if (categories.length > 0) {
      // Có danh mục khớp → lấy sản phẩm thuộc danh mục
      const categoryIds = categories.map(c => c._id)
      products = await productRepository.findByQuery(
        { productCategory: { $in: categoryIds }, deleted: false, status: 'active' },
        {
          select: 'title price discountPercentage stock slug soldQuantity rate',
          sort: { soldQuantity: -1 },
          limit: 6,
          lean: true
        }
      )
    }

    // Fallback: tìm trong description hoặc features của sản phẩm
    if (products.length === 0) {
      products = await productRepository.findByQuery(
        {
          deleted: false,
          status: 'active',
          $or: [
            { description: { $regex: escaped, $options: 'i' } },
            { features: { $regex: escaped, $options: 'i' } },
            { title: { $regex: escaped, $options: 'i' } }
          ]
        },
        {
          select: 'title price discountPercentage stock slug soldQuantity rate',
          sort: { soldQuantity: -1 },
          limit: 6,
          lean: true
        }
      )
    }

    if (products.length === 0) {
      // Gợi ý danh mục có sẵn
      const allCats = await productCategoryRepository.findAll(
        { deleted: false },
        { select: 'title', limit: 10, lean: true }
      )
      return JSON.stringify({
        found: false,
        message: `Mình chưa tìm thấy sản phẩm nào trong lĩnh vực "${keyword}".`,
        availableCategories: allCats.map(c => c.title),
        suggestion: 'Bạn có thể thử một trong các danh mục trên hoặc cho mình biết thêm chi tiết.'
      })
    }

    const results = products.map(p => {
      const finalPrice = p.discountPercentage ? Math.round(p.price * (1 - p.discountPercentage / 100)) : p.price
      return {
        productId: p._id.toString(),
        name: p.title,
        slug: p.slug,
        finalPrice: formatPrice(finalPrice),
        discount: p.discountPercentage ? `${p.discountPercentage}%` : null,
        inStock: p.stock > 0,
        sold: p.soldQuantity || 0,
        url: `${CLIENT_URL}/products/${p.slug}`
      }
    })

    return JSON.stringify({
      found: true,
      category: categories.length > 0 ? categories.map(c => c.title).join(', ') : keyword,
      count: results.length,
      products: results
    })
  } catch (err) {
    logger.error('[AI Tool] browseByCategory error:', err.message)
    return JSON.stringify({ found: false, error: 'Lỗi khi duyệt danh mục.' })
  }
}

/**
 * Lấy gợi ý sản phẩm cá nhân hóa từ endpoint recommendations
 */

async function getPersonalizedRecommendations({ tab, limit, page } = {}, context = {}) {
  try {
    const normalizedTab = normalizeRecommendationTab(tab)
    const normalizedLimit = normalizeToolLimit(limit, 5, 10)
    const normalizedPage = normalizeToolPage(page)
    const userId = normalizeUserId(context)
    const user = isMongoObjectId(userId) ? { id: userId } : null

    const result = await clientProductService.getRecommendations({
      user,
      query: {
        tab: normalizedTab,
        limit: normalizedLimit,
        page: normalizedPage
      }
    })

    const products = Array.isArray(result?.data) ? result.data : []
    if (products.length === 0) {
      return JSON.stringify({
        found: false,
        tab: normalizedTab,
        personalized: Boolean(user && normalizedTab === 'for-you'),
        message: 'Chua co san pham goi y phu hop luc nay.',
        suggestion: 'Hay cho minh biet nhu cau, ngan sach hoac san pham ban dang quan tam de minh tim chinh xac hon.'
      })
    }

    return JSON.stringify({
      found: true,
      tab: normalizedTab,
      page: normalizedPage,
      personalized: Boolean(user && normalizedTab === 'for-you'),
      count: products.length,
      hasMore: Boolean(result?.hasMore),
      products: products.map(buildCatalogProductPayload)
    })
  } catch (err) {
    logger.error('[AI Tool] getPersonalizedRecommendations error:', err.message)
    return JSON.stringify({ found: false, error: 'Loi khi lay danh sach goi y san pham.' })
  }
}

async function getRecentViewedProducts({
  limit,
  includeCurrentPage = true,
  includeRelated = true,
  relatedLimit
} = {}, context = {}) {
  try {
    const normalizedLimit = normalizeToolLimit(limit, 5, 10)
    const normalizedRelatedLimit = normalizeToolLimit(relatedLimit, 4, 8)
    const viewerKeys = buildProductViewViewerKeys(context)
    const currentPageProduct = includeCurrentPage !== false
      ? await resolveCurrentPageProduct(context)
      : null

    const recentViews = viewerKeys.length > 0
      ? await productViewRepository.findRecentViewedProducts(viewerKeys, normalizedLimit)
      : []
    const products = recentViews.map(buildRecentViewedProductPayload)
    const seenProductIds = new Set(products.map(product => product.productId).filter(Boolean))

    if (currentPageProduct && !seenProductIds.has(currentPageProduct._id.toString())) {
      products.unshift(buildRecentViewedProductPayload({
        product: currentPageProduct,
        viewedAt: null,
        source: 'current_page'
      }))
    }

    const limitedProducts = products.slice(0, normalizedLimit)
    if (limitedProducts.length === 0) {
      return JSON.stringify({
        found: false,
        requiresLogin: viewerKeys.length === 0,
        message: viewerKeys.length === 0
          ? 'Chua co du lieu san pham vua xem. Khach co the dang chua dang nhap hoac chat khong co ngu canh trang san pham.'
          : 'Chua ghi nhan san pham vua xem nao cho khach nay.',
        suggestion: 'Hoi khach san pham dang quan tam hoac dung getPersonalizedRecommendations/searchProducts de tu van chung.'
      })
    }

    const latestViewed = limitedProducts[0]
    let relatedProducts = []

    if (includeRelated !== false && latestViewed?.productId) {
      const relatedResult = await clientProductService.getExploreMore(latestViewed.productId, normalizedRelatedLimit)
      const recentIds = new Set(limitedProducts.map(product => product.productId).filter(Boolean))
      relatedProducts = (Array.isArray(relatedResult?.products) ? relatedResult.products : [])
        .map(buildCatalogProductPayload)
        .filter(product => product.productId && !recentIds.has(product.productId))
        .slice(0, normalizedRelatedLimit)
    }

    return JSON.stringify({
      found: true,
      count: limitedProducts.length,
      source: {
        hasUserHistory: viewerKeys.some(key => key.startsWith('user:')),
        hasIpHistory: viewerKeys.some(key => key.startsWith('ip:')),
        usedCurrentPageFallback: Boolean(currentPageProduct && limitedProducts[0]?.source === 'current_page')
      },
      latestViewed,
      products: limitedProducts,
      relatedProducts,
      adviceContext: {
        intent: 'recent_viewed_products',
        primaryProduct: latestViewed,
        hasRelatedSuggestions: relatedProducts.length > 0
      },
      message: relatedProducts.length > 0
        ? 'Da lay san pham vua xem va mot so goi y lien quan de tu van.'
        : 'Da lay san pham vua xem de tu van.'
    })
  } catch (err) {
    logger.error('[AI Tool] getRecentViewedProducts error:', err.message)
    return JSON.stringify({ found: false, error: 'Loi khi lay san pham vua xem.' })
  }
}

async function getRelatedProducts({ productId, productQuery, limit } = {}) {
  try {
    const normalizedLimit = normalizeToolLimit(limit, 5, 10)
    let product = null

    if (isMongoObjectId(productId)) {
      product = await productRepository.findById(productId.trim(), {
        select: 'title slug status deleted',
        lean: true
      })
    }

    if (!product && cleanString(productQuery)) {
      product = await findProductByQuery(productQuery)
    }

    if (!isSellableProduct(product)) {
      return JSON.stringify({
        found: false,
        message: `Khong tim thay san pham "${productQuery || productId || ''}" de lay goi y lien quan.`
      })
    }

    const result = await clientProductService.getExploreMore(product._id.toString(), normalizedLimit)
    const products = Array.isArray(result?.products) ? result.products : []

    return JSON.stringify({
      found: true,
      sourceProduct: {
        productId: product._id.toString(),
        name: product.title,
        slug: product.slug,
        url: product.slug ? `${CLIENT_URL}/products/${product.slug}` : null
      },
      count: products.length,
      products: products.map(buildCatalogProductPayload),
      message: products.length === 0 ? 'Chua co san pham lien quan phu hop luc nay.' : null
    })
  } catch (err) {
    logger.error('[AI Tool] getRelatedProducts error:', err.message)
    return JSON.stringify({ found: false, error: 'Loi khi lay san pham lien quan.' })
  }
}

/**
 * Lấy sản phẩm bán chạy / nổi bật
 */

async function getPopularProducts({ limit } = {}) {
  try {
    const max = Math.min(limit || 5, 10)

    const [bestsellers, featured] = await Promise.all([
      productRepository.findByQuery(
        { deleted: false, status: 'active' },
        {
          select: 'title price discountPercentage stock slug soldQuantity rate',
          sort: { soldQuantity: -1 },
          limit: max,
          lean: true
        }
      ),
      productRepository.findByQuery(
        { deleted: false, status: 'active', isFeatured: true },
        {
          select: 'title price discountPercentage stock slug soldQuantity rate',
          sort: { soldQuantity: -1 },
          limit: max,
          lean: true
        }
      )
    ])

    // Gộp và loại trùng
    const seen = new Set()
    const all = [...bestsellers, ...featured].filter(p => {
      if (seen.has(p.slug)) return false
      seen.add(p.slug)
      return true
    }).slice(0, max)

    const results = all.map(p => {
      const finalPrice = p.discountPercentage ? Math.round(p.price * (1 - p.discountPercentage / 100)) : p.price
      return {
        productId: p._id.toString(),
        name: p.title,
        slug: p.slug,
        finalPrice: formatPrice(finalPrice),
        discount: p.discountPercentage ? `${p.discountPercentage}%` : null,
        inStock: p.stock > 0,
        sold: p.soldQuantity || 0,
        rating: p.rate || null,
        url: `${CLIENT_URL}/products/${p.slug}`
      }
    })

    return JSON.stringify({
      found: true,
      count: results.length,
      products: results
    })
  } catch (err) {
    logger.error('[AI Tool] getPopularProducts error:', err.message)
    return JSON.stringify({ found: false, error: 'Lỗi khi lấy sản phẩm nổi bật.' })
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getProductReviewSummary({ productQuery } = {}) {
  try {
    const product = await findProductByQuery(productQuery)
    if (!product) {
      return JSON.stringify({
        found: false,
        message: `Không tìm thấy sản phẩm "${productQuery}".`
      })
    }

    const reviewFilter = {
      productId: product._id,
      deleted: false,
      hidden: { $ne: true }
    }

    const [summaryAgg, highlights, sellerReplyCount] = await Promise.all([
      reviewRepository.aggregate([
        { $match: reviewFilter },
        { $group: { _id: '$rating', count: { $sum: 1 } } }
      ]),
      reviewRepository.find({
        ...reviewFilter,
        $or: [
          { title: { $ne: '' } },
          { content: { $ne: '' } }
        ]
      }, {
        sort: { helpfulCount: -1, createdAt: -1 },
        limit: 3,
        populate: { path: 'userId', select: 'fullName username' },
        lean: true
      }),
      reviewRepository.countByQuery({
        ...reviewFilter,
        'sellerReply.content': { $exists: true, $ne: '' }
      })
    ])

    const ratingDist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    summaryAgg.forEach(item => {
      if (ratingDist[item._id] !== undefined) {
        ratingDist[item._id] = item.count
      }
    })

    const totalCount = Object.values(ratingDist).reduce((sum, count) => sum + count, 0)
    const avgRating = totalCount
      ? Math.round(
        (
          Object.entries(ratingDist)
            .reduce((sum, [rating, count]) => sum + Number(rating) * Number(count), 0)
          / totalCount
        ) * 10
      ) / 10
      : 0

    return JSON.stringify({
      found: true,
      product: {
        productId: product._id.toString(),
        name: product.title,
        slug: product.slug,
        category: product.productCategory?.title || null,
        url: `${CLIENT_URL}/products/${product.slug}`
      },
      summary: {
        avgRating,
        totalCount,
        sellerReplyCount,
        ratingDist
      },
      highlights: highlights.map(review => ({
        reviewId: review._id?.toString?.() || String(review._id || ''),
        rating: review.rating,
        title: review.title || '',
        excerpt: excerptText(review.content),
        helpfulCount: review.helpfulCount || 0,
        author: review.userId?.fullName || review.userId?.username || 'Khách hàng',
        createdAt: formatDate(review.createdAt),
        hasSellerReply: !!review.sellerReply?.content
      })),
      message: totalCount === 0
        ? 'Sản phẩm này chưa có đánh giá công khai nào.'
        : null
    })
  } catch (err) {
    logger.error('[AI Tool] getProductReviewSummary error:', err.message)
    return JSON.stringify({ found: false, error: 'Lỗi khi lấy tóm tắt đánh giá sản phẩm.' })
  }
}

async function getProductReviews(args = {}, context = {}) {
  try {
    const product = await resolveReviewProductInput(args)
    if (!product) {
      return JSON.stringify({
        found: false,
        message: `Khong tim thay san pham "${args.productQuery || args.productId || ''}".`
      })
    }

    const query = {
      sort: normalizeEnum(args.sort, ['newest', 'helpful', 'highRating', 'lowRating'], 'newest'),
      page: normalizeToolPage(args.page),
      limit: normalizeToolLimit(args.limit, 5, 10)
    }

    if (hasOwnProperty(args, 'rating') && args.rating !== undefined && args.rating !== null && args.rating !== '') {
      const rating = normalizeReviewRatingInput(args.rating)
      if (!rating) {
        return JSON.stringify({
          found: false,
          message: 'Rating filter phai la so nguyen tu 1 den 5.'
        })
      }
      query.rating = rating
    }

    const result = await clientReviewsService.getReviews({
      productId: product._id.toString(),
      query,
      user: buildReviewToolUser(context)
    })

    const reviews = Array.isArray(result.reviews) ? result.reviews.map(buildReviewToolPayload) : []

    return JSON.stringify({
      found: Number(result.total || 0) > 0,
      product: buildReviewProductPayload(product),
      page: query.page,
      limit: query.limit,
      total: result.total || 0,
      summary: result.summary || null,
      viewer: buildReviewViewerPayload(result.viewer || {}),
      reviews,
      message: reviews.length === 0
        ? 'Khong co review phu hop voi bo loc hien tai.'
        : null
    })
  } catch (err) {
    logger.error('[AI Tool] getProductReviews error:', err.message)
    return JSON.stringify({ found: false, error: 'Loi khi lay danh sach review san pham.' })
  }
}

async function createReview(args = {}, context = {}) {
  try {
    const user = buildReviewToolUser(context)
    if (!user) {
      return JSON.stringify({
        success: false,
        requiresLogin: true,
        message: 'Khach can dang nhap truoc khi tao danh gia.'
      })
    }

    const product = await resolveReviewProductInput(args)
    if (!product) {
      return JSON.stringify({
        success: false,
        found: false,
        message: `Khong tim thay san pham "${args.productQuery || args.productId || ''}" de danh gia.`
      })
    }

    const normalized = normalizeCreateReviewBody(args)
    if (normalized.error) return JSON.stringify(normalized.error)

    const result = await clientReviewsService.createReview({
      productId: product._id.toString(),
      body: normalized.body,
      files: [],
      user
    })

    return JSON.stringify({
      success: true,
      message: 'Da tao danh gia san pham thanh cong.',
      product: buildReviewProductPayload(product),
      review: buildReviewToolPayload(result.review),
      viewer: buildReviewViewerPayload(result.viewer || {})
    })
  } catch (err) {
    logger.error('[AI Tool] createReview error:', err.message)
    return JSON.stringify(buildReviewToolError(err, 'Khong the tao danh gia san pham.'))
  }
}

async function updateReview(args = {}, context = {}) {
  try {
    const user = buildReviewToolUser(context)
    if (!user) {
      return JSON.stringify({
        success: false,
        requiresLogin: true,
        message: 'Khach can dang nhap truoc khi sua danh gia.'
      })
    }

    const resolved = await resolveOwnReviewForTool({ ...args, userId: user.userId })
    if (resolved.error) return JSON.stringify(resolved.error)

    const normalized = normalizeUpdateReviewBody(args, resolved.review)
    if (normalized.error) return JSON.stringify(normalized.error)

    const result = await clientReviewsService.updateReview({
      reviewId: resolved.review._id.toString(),
      body: normalized.body,
      files: [],
      user
    })

    return JSON.stringify({
      success: true,
      message: 'Da cap nhat danh gia san pham thanh cong.',
      product: resolved.product ? buildReviewProductPayload(resolved.product) : null,
      review: buildReviewToolPayload(result.review)
    })
  } catch (err) {
    logger.error('[AI Tool] updateReview error:', err.message)
    return JSON.stringify(buildReviewToolError(err, 'Khong the cap nhat danh gia san pham.'))
  }
}

async function deleteReview(args = {}, context = {}) {
  try {
    const user = buildReviewToolUser(context)
    if (!user) {
      return JSON.stringify({
        success: false,
        requiresLogin: true,
        message: 'Khach can dang nhap truoc khi xoa danh gia.'
      })
    }

    const resolved = await resolveOwnReviewForTool({ ...args, userId: user.userId })
    if (resolved.error) return JSON.stringify(resolved.error)

    await clientReviewsService.deleteReview({
      reviewId: resolved.review._id.toString(),
      user
    })

    return JSON.stringify({
      success: true,
      deleted: true,
      message: 'Da xoa danh gia san pham thanh cong.',
      product: resolved.product ? buildReviewProductPayload(resolved.product) : null,
      reviewId: resolved.review._id.toString()
    })
  } catch (err) {
    logger.error('[AI Tool] deleteReview error:', err.message)
    return JSON.stringify(buildReviewToolError(err, 'Khong the xoa danh gia san pham.'))
  }
}

async function voteReview({ reviewId } = {}, context = {}) {
  try {
    const user = buildReviewToolUser(context)
    if (!user) {
      return JSON.stringify({
        success: false,
        requiresLogin: true,
        message: 'Khach can dang nhap truoc khi binh chon review.'
      })
    }

    const normalizedReviewId = cleanString(reviewId)
    if (!isMongoObjectId(normalizedReviewId)) {
      return JSON.stringify({
        success: false,
        message: 'reviewId khong hop le.'
      })
    }

    const result = await clientReviewsService.voteReview({
      reviewId: normalizedReviewId,
      user
    })

    return JSON.stringify({
      success: true,
      reviewId: normalizedReviewId,
      helpfulCount: result.helpfulCount,
      isVoted: result.isVoted,
      message: result.isVoted
        ? 'Da danh dau review nay la huu ich.'
        : 'Da bo danh dau huu ich cho review nay.'
    })
  } catch (err) {
    logger.error('[AI Tool] voteReview error:', err.message)
    return JSON.stringify(buildReviewToolError(err, 'Khong the cap nhat binh chon review.'))
  }
}

module.exports = {
  searchProducts,
  getProductDetail,
  checkProductAvailability,
  getProductAlternatives,
  subscribeBackInStock,
  unsubscribeBackInStock,
  compareProducts,
  getFlashSales,
  getAvailablePromoCodes,
  getCouponWallet,
  checkPromoCode,
  getVipBenefits,
  getLoyaltyStatus,
  searchBlogPosts,
  getBuyingGuides,
  browseByCategory,
  getPersonalizedRecommendations,
  getRecentViewedProducts,
  getRelatedProducts,
  getPopularProducts,
  getProductReviewSummary,
  getProductReviews,
  createReview,
  updateReview,
  deleteReview,
  voteReview
}
