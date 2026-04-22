const cron = require('node-cron')
const Product = require('../models/products.model')
const ProductView = require('../models/productView.model')
const Cart = require('../models/cart.model')
const Wishlist = require('../models/wishlist.model')
const logger = require('../../../config/logger')

/**
 * Tính lại recommendScore cho tất cả sản phẩm active.
 *
 * Công thức:
 *   score = viewsCount * 1 + wishlistCount * 3 + cartCount * 5 + soldQuantity * 10
 *
 * - viewsCount: đếm từ ProductView (TTL index tự xóa record > 30 ngày)
 * - cartCount: đếm distinct user HIỆN TẠI đang có product trong cart
 * - wishlistCount: đếm distinct user HIỆN TẠI đang có product trong wishlist
 * - soldQuantity: lấy trực tiếp từ Product
 */
async function recalculate() {
  const startTime = Date.now()
  logger.info('[RecommendScore] Bắt đầu tính lại...')

  try {
    // ── Bước 1: Đếm views per product (chỉ 30 ngày, đã được TTL index đảm bảo) ──
    const viewAgg = await ProductView.aggregate([{ $group: { _id: '$productId', count: { $sum: 1 } } }])
    const viewMap = new Map(viewAgg.map(v => [v._id.toString(), v.count]))

    // ── Bước 2: Đếm distinct users có product trong cart ──
    const cartAgg = await Cart.aggregate([
      { $unwind: '$items' },
      { $group: { _id: '$items.productId', count: { $addToSet: '$userId' } } },
      { $project: { _id: 1, count: { $size: '$count' } } }
    ])
    const cartMap = new Map(cartAgg.map(c => [c._id.toString(), c.count]))

    // ── Bước 3: Đếm distinct users có product trong wishlist ──
    const wishAgg = await Wishlist.aggregate([
      { $unwind: '$items' },
      { $group: { _id: '$items.productId', count: { $addToSet: '$userId' } } },
      { $project: { _id: 1, count: { $size: '$count' } } }
    ])
    const wishMap = new Map(wishAgg.map(w => [w._id.toString(), w.count]))

    // ── Bước 4: Lấy tất cả product active, tính score, bulk update ──
    const products = await Product.find({ deleted: false, status: 'active' }).select('_id soldQuantity viewsCount').lean()

    if (products.length === 0) {
      logger.info('[RecommendScore] Không có sản phẩm nào để tính.')
      return
    }

    const bulkOps = []

    for (const prod of products) {
      const pid = prod._id.toString()

      const views = viewMap.get(pid) || 0
      const cartCount = cartMap.get(pid) || 0
      const wishlistCount = wishMap.get(pid) || 0
      const soldQty = prod.soldQuantity || 0

      const score = views * 1 + wishlistCount * 3 + cartCount * 5 + soldQty * 10

      // Sync viewsCount từ aggregate (để đồng bộ khi TTL xóa views cũ)
      bulkOps.push({
        updateOne: {
          filter: { _id: prod._id },
          update: { $set: { recommendScore: score, viewsCount: views } }
        }
      })
    }

    if (bulkOps.length > 0) {
      await Product.bulkWrite(bulkOps, { ordered: false })
    }

    // Xóa cache recommendations để lần query kế tiếp lấy kết quả mới
    await require('../../../config/redis').del('products:recommendations:*')

    const elapsed = Date.now() - startTime
    logger.info(`[RecommendScore] Hoàn tất: ${products.length} sản phẩm, ${elapsed}ms`)
  } catch (err) {
    logger.error('[RecommendScore] Lỗi:', err.stack || err.message || err)
  }
}

/**
 * Khởi chạy cron job: mỗi 10 phút tính lại recommendScore
 */
function start() {
  // Chạy ngay lần đầu khi server start (delay 10 giây chờ DB kết nối)
  setTimeout(() => recalculate(), 10000)

  // Sau đó chạy mỗi 10 phút
  cron.schedule('*/10 * * * *', () => {
    recalculate()
  })

  logger.info('[RecommendScore] Cron job đã đăng ký: mỗi 10 phút')
}

module.exports = { start, recalculate }
