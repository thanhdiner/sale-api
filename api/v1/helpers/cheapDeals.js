const Product = require('../models/product/product.model')
const Order = require('../models/commerce/order.model')
const ProductView = require('../models/product/productView.model')

// ──────────────────────────────────────────────────────────────
// Scoring weights  (tổng = 1.0)
// ──────────────────────────────────────────────────────────────
const W = {
  discount:        0.25,   // a – % giảm giá
  priceAdvantage:  0.30,   // b – khoảng cách giá so với median
  ctrCvr:          0.20,   // c – tỉ lệ click/chuyển đổi
  stock:           0.10,   // d – tồn kho
  freshness:       0.15    // e – độ mới
}

// ──────────────────────────────────────────────────────────────
//  RANK 1 – Tính median & lọc nhóm dưới median theo category
// ──────────────────────────────────────────────────────────────

/**
 * Tính sale_price = price * (100 - discountPercentage) / 100
 */
function salePrice(product) {
  return product.price * (100 - (product.discountPercentage || 0)) / 100
}

/**
 * Tính median từ mảng đã sort tăng dần.
 *  - Chẵn → trung bình 2 phần tử giữa
 *  - Lẻ  → phần tử chính giữa
 */
function median(sortedArr) {
  const n = sortedArr.length
  if (n === 0) return 0
  const mid = Math.floor(n / 2)
  if (n % 2 === 0) {
    return (sortedArr[mid - 1] + sortedArr[mid]) / 2
  }
  return sortedArr[mid]
}

/**
 * Lấy tất cả product hợp lệ, nhóm theo category,
 * tính median sale_price mỗi category,
 * trả về chỉ các product < median (nhóm 1 – "siêu rẻ").
 */
async function filterBelowMedian() {
  const baseFilter = {
    status: 'active',
    deleted: false,
    stock: { $gt: 0 },
    price: { $gt: 0 },
    discountPercentage: { $gt: 0, $lte: 100 },
    thumbnail: { $exists: true, $nin: ['', null] }
  }

  // Lấy toàn bộ sản phẩm hợp lệ (lean = plain JS objects, nhẹ hơn)
  const allProducts = await Product.find(baseFilter)
    .select('title price discountPercentage stock soldQuantity viewsCount recommendScore productCategory createdAt thumbnail slug')
    .lean()

  // Nhóm theo category
  const catMap = {} // { categoryId: [product, ...] }
  for (const p of allProducts) {
    const catId = String(p.productCategory)
    if (!catMap[catId]) catMap[catId] = []
    catMap[catId].push(p)
  }

  // Với mỗi category, tính median rồi giữ lại nhóm < median
  const belowMedianProducts = []

  for (const catId of Object.keys(catMap)) {
    const catProducts = catMap[catId]

    // Tính sale_price & sort tăng dần
    const salePrices = catProducts
      .map(p => salePrice(p))
      .sort((a, b) => a - b)

    const med = median(salePrices)

    // Lọc sản phẩm có sale_price < median
    for (const p of catProducts) {
      const sp = salePrice(p)
      if (sp < med) {
        p._salePrice = sp
        p._categoryMedian = med
        belowMedianProducts.push(p)
      }
    }
  }

  return belowMedianProducts
}

// ──────────────────────────────────────────────────────────────
//  RANK 2 – Tính final_score cho từng product
// ──────────────────────────────────────────────────────────────

/**
 * Normalize giá trị v vào đoạn [0, 1] dựa trên min/max trong tập.
 * Tránh chia 0 khi min === max.
 */
function normalize(v, min, max) {
  if (max === min) return 1
  return (v - min) / (max - min)
}

/**
 * Tính CTR & CVR gần đúng từ dữ liệu hiện có:
 *   CTR  = viewsCount  (proxy – sản phẩm được click nhiều)
 *   CVR  = soldQuantity / viewsCount
 *   ctrCvr = CTR_norm * CVR_norm (kết hợp cả 2 tín hiệu)
 *
 * Vì không có dữ liệu impression riêng, viewsCount đóng vai trò CTR proxy.
 */
function computeCtrCvrScores(products) {
  const views = products.map(p => p.viewsCount || 0)
  const minV = Math.min(...views)
  const maxV = Math.max(...views)

  const cvrs = products.map(p => {
    const v = p.viewsCount || 0
    return v > 0 ? (p.soldQuantity || 0) / v : 0
  })
  const minC = Math.min(...cvrs)
  const maxC = Math.max(...cvrs)

  return products.map((p, i) => ({
    ctrNorm: normalize(views[i], minV, maxV),
    cvrNorm: normalize(cvrs[i], minC, maxC)
  }))
}

/**
 * Tính final_score cho mảng products (đã qua Rank 1).
 * Trả về mảng products đã gắn thêm field `_finalScore`.
 */
function scoreCheapDeals(products) {
  if (products.length === 0) return products

  const now = Date.now()

  // ── Discount (raw 0–100) → normalize ──
  const discounts = products.map(p => p.discountPercentage || 0)
  const minD = Math.min(...discounts)
  const maxD = Math.max(...discounts)

  // ── Price advantage = (median – salePrice) / median  → càng xa median càng tốt ──
  const advantages = products.map(p =>
    p._categoryMedian > 0
      ? (p._categoryMedian - p._salePrice) / p._categoryMedian
      : 0
  )
  const minA = Math.min(...advantages)
  const maxA = Math.max(...advantages)

  // ── CTR / CVR ──
  const ctrCvrArr = computeCtrCvrScores(products)

  // ── Stock ── normalize
  const stocks = products.map(p => p.stock || 0)
  const minS = Math.min(...stocks)
  const maxS = Math.max(...stocks)

  // ── Freshness = 1 / (ageInDays + 1), rồi normalize ──
  const freshArr = products.map(p => {
    const ageMs = now - new Date(p.createdAt).getTime()
    const ageDays = ageMs / (1000 * 60 * 60 * 24)
    return 1 / (ageDays + 1)
  })
  const minF = Math.min(...freshArr)
  const maxF = Math.max(...freshArr)

  // ── Tính final_score ──
  for (let i = 0; i < products.length; i++) {
    const d = normalize(discounts[i], minD, maxD)
    const a = normalize(advantages[i], minA, maxA)
    const cc = (ctrCvrArr[i].ctrNorm + ctrCvrArr[i].cvrNorm) / 2
    const s = normalize(stocks[i], minS, maxS)
    const f = normalize(freshArr[i], minF, maxF)

    products[i]._finalScore =
      W.discount       * d +
      W.priceAdvantage  * a +
      W.ctrCvr          * cc +
      W.stock           * s +
      W.freshness       * f
  }

  return products
}

// ──────────────────────────────────────────────────────────────
//  RANK 3 – Sort, dedup, phân trang, trả kết quả
// ──────────────────────────────────────────────────────────────

/**
 * Entry point cho tab "Deal Siêu Rẻ".
 * @param {number} page  – trang (1-based)
 * @param {number} limit – số item / trang
 * @returns {{ data: object[], hasMore: boolean }}
 */
async function getCheapDeals(page, limit) {
  console.log(`\n=== ĐANG GỌI HÀM GET CHEAP DEALS (Page: ${page}, Limit: ${limit}) ===`);
  
  // Rank 1 – Filter below-median products
  const belowMedian = await filterBelowMedian()
  console.log(`- Số lượng sản phẩm lọt qua Rank 1 (dưới Median): ${belowMedian.length}`);

  // Rank 2 – Score
  scoreCheapDeals(belowMedian)

  // Rank 3 – Sort desc by final_score
  belowMedian.sort((a, b) => b._finalScore - a._finalScore)

  // Dedup (cùng _id → giữ cái đầu = score cao hơn)
  const seen = new Set()
  const deduped = []
  for (const p of belowMedian) {
    const id = String(p._id)
    if (!seen.has(id)) {
      seen.add(id)
      deduped.push(p)
    }
  }

  // Phân trang
  const skip = (page - 1) * limit
  const paged = deduped.slice(skip, skip + limit)

  // Tính priceNew & dọn các field tạm
  const data = paged.map(p => {
    const priceNew = (p.price * (100 - p.discountPercentage) / 100).toFixed(2)
    
    // Log ra để kiểm tra thuật toán chấm điểm
    console.log(`[DEAL SIÊU RẺ] SP: ${p.title} | Giảm: ${p.discountPercentage}% | Điểm: ${p._finalScore.toFixed(3)} | Dưới Median: ${p._salePrice} < ${p._categoryMedian}`);
    
    // Xóa các field tạm trước khi trả client
    const { _salePrice, _categoryMedian, _finalScore, ...rest } = p
    return { ...rest, priceNew }
  })

  const hasMore = skip + limit < deduped.length

  return { data, hasMore }
}

module.exports = { getCheapDeals }









