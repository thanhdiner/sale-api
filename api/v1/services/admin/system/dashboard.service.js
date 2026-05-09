const adminAccountRepository = require('../../../repositories/access/adminAccount.repository')
const userRepository = require('../../../repositories/access/user.repository')
const orderRepository = require('../../../repositories/commerce/order.repository')
const cartRepository = require('../../../repositories/commerce/cart.repository')
const reviewRepository = require('../../../repositories/commerce/review.repository')
const productRepository = require('../../../repositories/product/product.repository')
const productCategoryRepository = require('../../../repositories/product/productCategory.repository')
const cache = require('../../../../../config/redis')

const SUMMARY_TTL = 30
const CHARTS_TTL = 60
const TOP_CUSTOMERS_TTL = 300
const BEST_SELLING_PRODUCTS_TTL = 300
const RECENT_ORDERS_TTL = 15
const ORDER_STATUSES = ['', 'pending', 'confirmed', 'shipping', 'completed', 'cancelled']
const RANGE_ALIASES = {
  '7d': '7days',
  '30d': '30days',
  '90d': '90days'
}
const ALLOWED_RANGES = new Set(['7days', '30days', '90days'])

const normalizeLanguage = language => (String(language || '').toLowerCase().startsWith('en') ? 'en' : 'vi')

const hasText = value => typeof value === 'string' && value.trim().length > 0

function getLocalizedText(language, translatedValue, baseValue, fallback = '') {
  if (language === 'en' && hasText(translatedValue)) return translatedValue.trim()
  if (hasText(baseValue)) return baseValue.trim()
  if (hasText(fallback)) return fallback.trim()
  return fallback || ''
}

const calcChange = (current, previous) => {
  if (previous === 0) {
    if (current === 0) return { change: 0, trend: 'up' }
    return { change: 100, trend: 'up' }
  }

  const diff = current - previous
  const percent = (diff / previous) * 100

  return {
    change: Math.abs(Number(percent.toFixed(1))),
    trend: percent >= 0 ? 'up' : 'down'
  }
}

function normalizeRange(range) {
  const normalizedRange = RANGE_ALIASES[range] || range
  return ALLOWED_RANGES.has(normalizedRange) ? normalizedRange : '7days'
}

function normalizeLimit(limit, fallback, max) {
  const value = Number(limit)

  if (!Number.isInteger(value) || value <= 0) {
    return fallback
  }

  return Math.min(value, max)
}

function getLastNDays(n) {
  const days = []
  const now = new Date()

  for (let i = n - 1; i >= 0; i--) {
    const date = new Date(now)
    date.setHours(0, 0, 0, 0)
    date.setDate(date.getDate() - i)
    days.push(date)
  }

  return days
}

function getRangeDayCount(range) {
  if (range === '30days') return 30
  if (range === '90days') return 90
  return 7
}

function getDateRanges() {
  const now = new Date()
  const thisWeekStart = new Date()
  const lastWeekStart = new Date()

  thisWeekStart.setDate(now.getDate() - 7)
  lastWeekStart.setDate(now.getDate() - 14)

  return {
    thisWeek: { from: thisWeekStart, to: now },
    lastWeek: { from: lastWeekStart, to: thisWeekStart }
  }
}

function wrapDashboardResponse(data, message) {
  return {
    success: true,
    message,
    data
  }
}

async function buildDashboardSummary() {
  const statistic = {
    adminAccount: { total: 0, active: 0, inactive: 0, new: {} },
    user: { total: 0, active: 0, inactive: 0, new: {} },
    product: { total: 0, active: 0, inactive: 0, new: {} },
    category: { total: 0, active: 0, inactive: 0, new: {} },
    order: {},
    pendingActions: { ordersToConfirm: 0, refundsToProcess: 0, receiptsToReview: 0, reviewsToApprove: 0 },
    totalRevenue: { value: 0, change: 0, trend: 'up' },
    profit: { value: 0, change: 0, trend: 'up' },
    conversionFunnel: {
      visitors: 0,
      productViews: 0,
      addToCart: 0,
      orders: 0,
      completed: 0
    }
  }

  const { thisWeek, lastWeek } = getDateRanges()

  const [
    adminTotal, adminActive, adminInactive, adminThisWeek, adminLastWeek,
    userTotal, userActive, userInactive, userThisWeek, userLastWeek,
    productTotal, productActive, productInactive, productThisWeek, productLastWeek,
    categoryTotal, categoryActive, categoryInactive, categoryThisWeek, categoryLastWeek
  ] = await Promise.all([
    adminAccountRepository.countByQuery({ deleted: false }),
    adminAccountRepository.countByQuery({ status: 'active', deleted: false }),
    adminAccountRepository.countByQuery({ status: 'inactive', deleted: false }),
    adminAccountRepository.countByQuery({ deleted: false, createdAt: { $gte: thisWeek.from, $lt: thisWeek.to } }),
    adminAccountRepository.countByQuery({ deleted: false, createdAt: { $gte: lastWeek.from, $lt: thisWeek.from } }),

    userRepository.countByQuery({ deleted: false }),
    userRepository.countByQuery({ status: 'active', deleted: false }),
    userRepository.countByQuery({ status: 'inactive', deleted: false }),
    userRepository.countByQuery({ deleted: false, createdAt: { $gte: thisWeek.from, $lt: thisWeek.to } }),
    userRepository.countByQuery({ deleted: false, createdAt: { $gte: lastWeek.from, $lt: thisWeek.from } }),

    productRepository.countByQuery({ deleted: false }),
    productRepository.countByQuery({ status: 'active', deleted: false }),
    productRepository.countByQuery({ status: 'inactive', deleted: false }),
    productRepository.countByQuery({ deleted: false, createdAt: { $gte: thisWeek.from, $lt: thisWeek.to } }),
    productRepository.countByQuery({ deleted: false, createdAt: { $gte: lastWeek.from, $lt: thisWeek.from } }),

    productCategoryRepository.countByQuery({ deleted: false }),
    productCategoryRepository.countByQuery({ status: 'active', deleted: false }),
    productCategoryRepository.countByQuery({ status: 'inactive', deleted: false }),
    productCategoryRepository.countByQuery({ deleted: false, createdAt: { $gte: thisWeek.from, $lt: thisWeek.to } }),
    productCategoryRepository.countByQuery({ deleted: false, createdAt: { $gte: lastWeek.from, $lt: thisWeek.from } })
  ])

  statistic.adminAccount = {
    total: adminTotal,
    active: adminActive,
    inactive: adminInactive,
    new: { current: adminThisWeek, previous: adminLastWeek, ...calcChange(adminThisWeek, adminLastWeek) }
  }
  statistic.user = {
    total: userTotal,
    active: userActive,
    inactive: userInactive,
    new: { current: userThisWeek, previous: userLastWeek, ...calcChange(userThisWeek, userLastWeek) }
  }
  statistic.product = {
    total: productTotal,
    active: productActive,
    inactive: productInactive,
    new: { current: productThisWeek, previous: productLastWeek, ...calcChange(productThisWeek, productLastWeek) }
  }
  statistic.category = {
    total: categoryTotal,
    active: categoryActive,
    inactive: categoryInactive,
    new: { current: categoryThisWeek, previous: categoryLastWeek, ...calcChange(categoryThisWeek, categoryLastWeek) }
  }

  const orderStatusStats = {}
  await Promise.all(
    ORDER_STATUSES.map(async status => {
      const baseFilter = { isDeleted: false }
      if (status) baseFilter.status = status

      const [total, newWeek, lastWeekCount] = await Promise.all([
        orderRepository.countByQuery(baseFilter),
        orderRepository.countByQuery({ ...baseFilter, createdAt: { $gte: thisWeek.from, $lt: thisWeek.to } }),
        orderRepository.countByQuery({ ...baseFilter, createdAt: { $gte: lastWeek.from, $lt: thisWeek.from } })
      ])

      orderStatusStats[status || 'all'] = {
        total,
        new: { current: newWeek, previous: lastWeekCount, ...calcChange(newWeek, lastWeekCount) }
      }
    })
  )
  statistic.order = orderStatusStats

  const [refundsToProcess, reviewsToApprove] = await Promise.all([
    orderRepository.countByQuery({
      isDeleted: false,
      $or: [
        { 'returnRefund.status': { $in: ['requested', 'under_review', 'approved', 'processing'] } },
        { 'returnRefund.refundStatus': { $in: ['requested', 'under_review', 'approved', 'processing'] } }
      ]
    }),
    reviewRepository.countByQuery({
      deleted: false,
      hidden: { $ne: true },
      $or: [
        { 'sellerReply.content': { $exists: false } },
        { 'sellerReply.content': '' },
        { sellerReply: { $exists: false } }
      ]
    })
  ])

  statistic.pendingActions = {
    ordersToConfirm: orderStatusStats.pending?.total || 0,
    refundsToProcess,
    receiptsToReview: 0,
    reviewsToApprove
  }

  const [revenueThisWeek, revenueLastWeek, profitThisWeek, profitLastWeek] = await Promise.all([
    orderRepository.aggregate([
      { $match: { isDeleted: false, status: 'completed', createdAt: { $gte: thisWeek.from, $lt: thisWeek.to } } },
      { $group: { _id: null, total: { $sum: '$total' } } }
    ]),
    orderRepository.aggregate([
      { $match: { isDeleted: false, status: 'completed', createdAt: { $gte: lastWeek.from, $lt: thisWeek.from } } },
      { $group: { _id: null, total: { $sum: '$total' } } }
    ]),
    orderRepository.aggregate([
      { $match: { isDeleted: false, status: 'completed', createdAt: { $gte: thisWeek.from, $lt: thisWeek.to } } },
      { $unwind: '$orderItems' },
      {
        $group: {
          _id: null,
          profit: {
            $sum: {
              $multiply: [{ $subtract: ['$orderItems.price', '$orderItems.costPrice'] }, '$orderItems.quantity']
            }
          }
        }
      }
    ]),
    orderRepository.aggregate([
      { $match: { isDeleted: false, status: 'completed', createdAt: { $gte: lastWeek.from, $lt: thisWeek.from } } },
      { $unwind: '$orderItems' },
      {
        $group: {
          _id: null,
          profit: {
            $sum: {
              $multiply: [{ $subtract: ['$orderItems.price', '$orderItems.costPrice'] }, '$orderItems.quantity']
            }
          }
        }
      }
    ])
  ])

  const revenueCurrent = revenueThisWeek[0]?.total || 0
  const revenuePrevious = revenueLastWeek[0]?.total || 0
  statistic.totalRevenue = { value: revenueCurrent, ...calcChange(revenueCurrent, revenuePrevious) }

  const profitCurrent = profitThisWeek[0]?.profit || 0
  const profitPrevious = profitLastWeek[0]?.profit || 0
  statistic.profit = { value: profitCurrent, ...calcChange(profitCurrent, profitPrevious) }

  const [productViewsAgg, cartItemsAgg] = await Promise.all([
    productRepository.aggregate([
      { $match: { deleted: false } },
      { $group: { _id: null, total: { $sum: { $ifNull: ['$viewsCount', 0] } } } }
    ]),
    cartRepository.aggregate([
      { $unwind: '$items' },
      {
        $group: {
          _id: null,
          total: {
            $sum: {
              $ifNull: ['$items.quantity', 1]
            }
          }
        }
      }
    ])
  ])

  statistic.conversionFunnel = {
    visitors: userTotal,
    productViews: productViewsAgg[0]?.total || 0,
    addToCart: cartItemsAgg[0]?.total || 0,
    orders: statistic.order.all.total || 0,
    completed: statistic.order.completed.total || 0
  }

  return statistic
}

async function buildDashboardCharts(range, languageInput = 'vi') {
  const language = normalizeLanguage(languageInput)
  const lastNDays = getLastNDays(getRangeDayCount(range))

  const [salesAgg, categoryStats, paymentMethodStats] = await Promise.all([
    orderRepository.aggregate([
      { $match: { isDeleted: false, status: 'completed', createdAt: { $gte: lastNDays[0], $lt: new Date() } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, total: { $sum: '$total' } } },
      { $sort: { _id: 1 } }
    ]),
    productRepository.aggregate([
      { $match: { deleted: false } },
      { $group: { _id: '$productCategory', total: { $sum: 1 } } },
      { $lookup: { from: 'product_categories', localField: '_id', foreignField: '_id', as: 'categoryInfo' } },
      { $unwind: '$categoryInfo' },
      {
        $project: {
          title: '$categoryInfo.title',
          translations: '$categoryInfo.translations',
          thumbnail: '$categoryInfo.thumbnail',
          status: '$categoryInfo.status',
          total: 1
        }
      },
      { $sort: { total: -1 } }
    ]),
    orderRepository.aggregate([
      {
        $match: {
          isDeleted: false,
          status: { $ne: 'cancelled' },
          paymentMethod: { $exists: true, $ne: null },
          createdAt: { $gte: lastNDays[0], $lt: new Date() }
        }
      },
      { $group: { _id: '$paymentMethod', total: { $sum: '$total' }, count: { $sum: 1 } } },
      { $sort: { total: -1 } }
    ])
  ])

  const salesMap = new Map(salesAgg.map(item => [item._id, item.total]))
  const salesNDays = lastNDays.map(date => {
    const key = date.toISOString().slice(0, 10)
    return { date: key, value: salesMap.get(key) || 0 }
  })

  return {
    salesNDays,
    categoryStats: categoryStats.map(category => ({
      _id: category._id,
      title: category.title,
      translations: category.translations,
      thumbnail: category.thumbnail,
      status: category.status,
      name: getLocalizedText(language, category.translations?.en?.title, category.title),
      total: category.total
    })),
    paymentMethodStats: paymentMethodStats.map(item => ({
      method: item._id || 'unknown',
      total: item.total || 0,
      count: item.count || 0
    }))
  }
}

async function buildDashboardTopCustomers(limit) {
  const topCustomers = await orderRepository.aggregate([
    { $match: { isDeleted: false, status: 'completed', userId: { $ne: null } } },
    { $group: { _id: '$userId', totalSpent: { $sum: '$total' }, totalOrders: { $sum: 1 } } },
    { $sort: { totalSpent: -1 } },
    { $limit: limit },
    { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'userInfo' } },
    { $unwind: '$userInfo' },
    {
      $project: {
        _id: 1,
        totalSpent: 1,
        totalOrders: 1,
        fullName: '$userInfo.fullName',
        avatarUrl: '$userInfo.avatarUrl',
        email: '$userInfo.email'
      }
    }
  ])

  return { topCustomers }
}

async function buildDashboardRecentOrders(limit) {
  const recentOrders = await orderRepository.aggregate([
    { $match: { isDeleted: false } },
    { $sort: { createdAt: -1 } },
    { $limit: limit },
    { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'userInfo' } },
    { $unwind: { path: '$userInfo', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 1,
        orderId: '$_id',
        customer: { $ifNull: ['$userInfo.fullName', { $concat: ['$contact.firstName', ' ', '$contact.lastName'] }] },
        avatar: '$userInfo.avatarUrl',
        amount: '$total',
        status: 1,
        time: '$createdAt'
      }
    }
  ])

  return { recentOrders }
}

async function buildDashboardBestSellingProducts(limit, languageInput = 'vi', range = '7days') {
  const language = normalizeLanguage(languageInput)
  const dayCount = getRangeDayCount(normalizeRange(range))
  const now = new Date()
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - dayCount)

  const prevWeekStart = new Date(now)
  prevWeekStart.setDate(now.getDate() - dayCount * 2)

  const [productsThisWeek, productsPrevWeek] = await Promise.all([
    orderRepository.aggregate([
      { $match: { isDeleted: false, status: 'completed', createdAt: { $gte: weekStart, $lt: now } } },
      { $unwind: '$orderItems' },
      {
        $group: {
          _id: '$orderItems.productId',
          fallbackName: { $first: '$orderItems.name' },
          image: { $first: '$orderItems.image' },
          sales: { $sum: '$orderItems.quantity' },
          revenue: { $sum: { $multiply: ['$orderItems.price', '$orderItems.quantity'] } }
        }
      },
      { $sort: { sales: -1 } },
      { $limit: limit },
      { $lookup: { from: 'products', localField: '_id', foreignField: '_id', as: 'productInfo' } },
      { $unwind: { path: '$productInfo', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          fallbackName: 1,
          image: 1,
          productImage: '$productInfo.thumbnail',
          title: '$productInfo.title',
          translations: '$productInfo.translations',
          sales: 1,
          revenue: 1
        }
      }
    ]),
    orderRepository.aggregate([
      { $match: { isDeleted: false, status: 'completed', createdAt: { $gte: prevWeekStart, $lt: weekStart } } },
      { $unwind: '$orderItems' },
      { $group: { _id: '$orderItems.productId', sales: { $sum: '$orderItems.quantity' } } }
    ])
  ])

  const prevWeekMap = new Map()
  productsPrevWeek.forEach(product => prevWeekMap.set(String(product._id), product.sales))

  return {
    topProducts: productsThisWeek.map(product => {
      const prevSales = prevWeekMap.get(String(product._id)) || 0
      return {
        ...product,
        image: product.image || product.productImage || '',
        name: getLocalizedText(language, product.translations?.en?.title, product.title, product.fallbackName),
        trend: prevSales > product.sales ? 'down' : prevSales === product.sales ? 'equal' : 'up'
      }
    })
  }
}

async function getCachedSummaryData() {
  return cache.getOrSet('dashboard:summary', buildDashboardSummary, SUMMARY_TTL)
}

async function getCachedChartsData(range = '7days', language = 'vi') {
  const normalizedRange = normalizeRange(range)
  const normalizedLanguage = normalizeLanguage(language)
  return cache.getOrSet(
    `dashboard:charts:${normalizedRange}:${normalizedLanguage}`,
    () => buildDashboardCharts(normalizedRange, normalizedLanguage),
    CHARTS_TTL
  )
}

async function getCachedTopCustomersData(limit = 5) {
  const normalizedLimit = normalizeLimit(limit, 5, 20)

  return cache.getOrSet(
    `dashboard:top-customers:${normalizedLimit}`,
    () => buildDashboardTopCustomers(normalizedLimit),
    TOP_CUSTOMERS_TTL
  )
}

async function getCachedRecentOrdersData(limit = 10) {
  const normalizedLimit = normalizeLimit(limit, 10, 50)

  return cache.getOrSet(
    `dashboard:recent-orders:${normalizedLimit}`,
    () => buildDashboardRecentOrders(normalizedLimit),
    RECENT_ORDERS_TTL
  )
}

async function getCachedBestSellingProductsData(limit = 5, language = 'vi', range = '7days') {
  const normalizedLimit = normalizeLimit(limit, 5, 20)
  const normalizedLanguage = normalizeLanguage(language)
  const normalizedRange = normalizeRange(range)

  return cache.getOrSet(
    `dashboard:best-selling-products:${normalizedLimit}:${normalizedLanguage}:${normalizedRange}`,
    () => buildDashboardBestSellingProducts(normalizedLimit, normalizedLanguage, normalizedRange),
    BEST_SELLING_PRODUCTS_TTL
  )
}

async function getDashboardSummary() {
  const data = await getCachedSummaryData()
  return wrapDashboardResponse(data, 'Dashboard summary retrieved successfully')
}

async function getDashboardCharts(range = '7days', language = 'vi') {
  const data = await getCachedChartsData(range, language)
  return wrapDashboardResponse(data, 'Dashboard charts retrieved successfully')
}

async function getDashboardTopCustomers(limit) {
  const data = await getCachedTopCustomersData(limit)
  return wrapDashboardResponse(data, 'Dashboard top customers retrieved successfully')
}

async function getDashboardRecentOrders(limit) {
  const data = await getCachedRecentOrdersData(limit)
  return wrapDashboardResponse(data, 'Dashboard recent orders retrieved successfully')
}

async function getDashboardBestSellingProducts(limit, language = 'vi', range = '7days') {
  const data = await getCachedBestSellingProductsData(limit, language, range)
  return wrapDashboardResponse(data, 'Dashboard best selling products retrieved successfully')
}

async function getDashboard(range = '7days', language = 'vi') {
  const normalizedRange = normalizeRange(range)
  const [summary, charts, topCustomers, recentOrders, bestSellingProducts] = await Promise.all([
    getCachedSummaryData(),
    getCachedChartsData(normalizedRange, language),
    getCachedTopCustomersData(),
    getCachedRecentOrdersData(),
    getCachedBestSellingProductsData(5, language, normalizedRange)
  ])

  return wrapDashboardResponse(
    {
      ...summary,
      ...charts,
      ...topCustomers,
      ...recentOrders,
      ...bestSellingProducts
    },
    'Dashboard statistics retrieved successfully'
  )
}

module.exports = {
  getDashboard,
  getDashboardSummary,
  getDashboardCharts,
  getDashboardTopCustomers,
  getDashboardRecentOrders,
  getDashboardBestSellingProducts
}












