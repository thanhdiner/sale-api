const cache = require('../../../../config/redis')
const logger = require('../../../../config/logger')
const { CACHE_INVALIDATION_PATTERNS } = require('./cacheInvalidation.patterns')

// dùng để xóa cache
function invalidateAfter(patterns) {
  return (req, res, next) => {
    const originalJson = res.json.bind(res)

    res.json = body => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        cache.del(...patterns).catch(err => logger.warn('[Cache] Invalidation error:', err.message))
      }

      return originalJson(body)
    }

    next()
  }
}

// định nghĩa và export ra những middleware để khi mình call tới là nó sẽ xóa theo đúng theo những pattern mình đã định nghĩa
const invalidateProducts = invalidateAfter(CACHE_INVALIDATION_PATTERNS.products)
const invalidateCategories = invalidateAfter(CACHE_INVALIDATION_PATTERNS.categories)
const invalidateBanners = invalidateAfter(CACHE_INVALIDATION_PATTERNS.banners)
const invalidateWidgets = invalidateAfter(CACHE_INVALIDATION_PATTERNS.widgets)
const invalidateBankInfo = invalidateAfter(CACHE_INVALIDATION_PATTERNS.bankInfo)
const invalidateFlashSales = invalidateAfter(CACHE_INVALIDATION_PATTERNS.flashSales)
const invalidateAboutContent = invalidateAfter(CACHE_INVALIDATION_PATTERNS.aboutContent)
const invalidateTermsContent = invalidateAfter(CACHE_INVALIDATION_PATTERNS.termsContent)
const invalidateCooperationContactContent = invalidateAfter(CACHE_INVALIDATION_PATTERNS.cooperationContactContent)
const invalidateHomeBuildYourKitContent = invalidateAfter(CACHE_INVALIDATION_PATTERNS.homeBuildYourKitContent)
const invalidateHomeWhyChooseUsContent = invalidateAfter(CACHE_INVALIDATION_PATTERNS.homeWhyChooseUsContent)
const invalidateBlog = invalidateAfter(CACHE_INVALIDATION_PATTERNS.blog)
const invalidateDashboard = invalidateAfter(CACHE_INVALIDATION_PATTERNS.dashboard)

module.exports = {
  invalidateAfter,
  invalidateProducts,
  invalidateCategories,
  invalidateBanners,
  invalidateWidgets,
  invalidateBankInfo,
  invalidateFlashSales,
  invalidateAboutContent,
  invalidateTermsContent,
  invalidateCooperationContactContent,
  invalidateHomeBuildYourKitContent,
  invalidateHomeWhyChooseUsContent,
  invalidateBlog,
  invalidateDashboard
}
