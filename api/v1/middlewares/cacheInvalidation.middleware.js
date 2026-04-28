/**
 * Cache Invalidation Middleware
 *
 * Tự động xóa cache liên quan sau khi các admin mutation request thành công.
 * Gắn vào sau controller bằng cách wrap response.
 *
 * Dùng pattern-based deletion để xóa toàn bộ group cache liên quan.
 */

const cache = require('../../../config/redis')
const logger = require('../../../config/logger')

/**
 * Wrap res.json để hook vào sau khi response thành công
 * rồi xóa các cache keys theo pattern
 */
function invalidateAfter(...patterns) {
  return (req, res, next) => {
    const originalJson = res.json.bind(res)

    res.json = function (body) {
      // Chỉ invalidate nếu mutation thành công (2xx)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        // Xóa cache async — không block response
        cache.del(...patterns).catch(err =>
          logger.warn('[Cache] Invalidation error:', err.message)
        )
      }
      return originalJson(body)
    }

    next()
  }
}

// ─── Product cache patterns ───────────────────────────────────────────────────
// Xóa tất cả cache products: list, detail, suggest, category products
const invalidateProducts = invalidateAfter(
  'products:list:*',
  'products:detail:*',
  'products:suggest:*',
  'products:recommendations:*',
  'products:explore-more:*',
  'categories:slug:*',   // category pages hiển thị sản phẩm
  'dashboard:*'          // dashboard counts products
)

// ─── Category cache patterns ──────────────────────────────────────────────────
const invalidateCategories = invalidateAfter(
  'categories:tree',
  'categories:slug:*',
  'dashboard:*'
)

// ─── Banner / Widget / BankInfo / Config ──────────────────────────────────────
const invalidateBanners  = invalidateAfter('banners:active', 'banners:active:*')
const invalidateWidgets  = invalidateAfter('widgets:active')
const invalidateBankInfo = invalidateAfter('bankinfo:active')
const invalidateFlashSales = invalidateAfter('flashsales:list:*', 'flashsales:detail:*')
const invalidateAboutContent = invalidateAfter('about:content:*')
const invalidateTermsContent = invalidateAfter('terms:content:*')
const invalidateCooperationContactContent = invalidateAfter('cooperation-contact:content:*')
const invalidateHomeWhyChooseUsContent = invalidateAfter('home-why-choose-us:content:*')
const invalidateBlog = invalidateAfter('blog:list:*', 'blog:detail:*')

// ─── Dashboard ────────────────────────────────────────────────────────────────
// Dùng khi order status thay đổi
const invalidateDashboard = invalidateAfter('dashboard:*')

module.exports = {
  invalidateProducts,
  invalidateCategories,
  invalidateBanners,
  invalidateWidgets,
  invalidateBankInfo,
  invalidateFlashSales,
  invalidateAboutContent,
  invalidateTermsContent,
  invalidateCooperationContactContent,
  invalidateHomeWhyChooseUsContent,
  invalidateBlog,
  invalidateDashboard
}
