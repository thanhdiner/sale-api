/**
 * AI Tools — Function Calling definitions & executors
 * Cho phép AI chatbot truy vấn Database để trả lời khách hàng
 *
 * Hỗ trợ: searchProduct, getProductDetail, checkOrderStatus, getFlashSales
 */

const Product = require('../../models/products.model')
const ProductCategory = require('../../models/product-category.model')
const Order = require('../../models/order.model')
const logger = require('../../../../config/logger')

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000'

// ─── Tool Definitions (OpenAI function calling schema) ───────────────────────

const toolDefinitions = [
  {
    type: 'function',
    function: {
      name: 'searchProducts',
      description: 'Tìm kiếm sản phẩm trên SmartMall theo từ khoá. Trả về danh sách sản phẩm gồm tên, giá, tồn kho, link.',
      parameters: {
        type: 'object',
        properties: {
          keyword: {
            type: 'string',
            description: 'Từ khoá tìm kiếm sản phẩm'
          }
        },
        required: ['keyword']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getProductDetail',
      description: 'Lấy thông tin chi tiết của một sản phẩm cụ thể. Ưu tiên dùng slug từ kết quả searchProducts. Nếu không có slug, có thể dùng tên sản phẩm.',
      parameters: {
        type: 'object',
        properties: {
          slug: {
            type: 'string',
            description: 'Slug sản phẩm (lấy từ kết quả searchProducts) hoặc tên sản phẩm'
          }
        },
        required: ['slug']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'checkOrderStatus',
      description: 'Kiểm tra trạng thái đơn hàng theo mã đơn hàng (Order ID). Dùng khi khách hỏi về tình trạng đơn hàng, giao hàng, thanh toán.',
      parameters: {
        type: 'object',
        properties: {
          orderId: {
            type: 'string',
            description: 'Mã đơn hàng (MongoDB ObjectId hoặc mã đơn mà khách cung cấp)'
          }
        },
        required: ['orderId']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getFlashSales',
      description: 'Lấy danh sách sản phẩm đang khuyến mãi giảm giá.',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'browseByCategory',
      description: `Duyệt sản phẩm theo danh mục/chủ đề. Dùng khi khách hàng hỏi chung chung về một lĩnh vực như "giải trí", "học tập", "làm việc", "streaming", "design", hoặc muốn xem có gì hay, đề xuất sản phẩm. Ví dụ: khách nói "có gì hay ko", "tôi muốn giải trí", "sản phẩm cho dân design" thì dùng tool này.`,
      parameters: {
        type: 'object',
        properties: {
          categoryKeyword: {
            type: 'string',
            description: 'Từ khoá danh mục hoặc lĩnh vực khách quan tâm (ví dụ: giải trí, học tập, streaming, design, văn phòng)'
          }
        },
        required: ['categoryKeyword']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getPopularProducts',
      description: 'Lấy danh sách sản phẩm bán chạy nhất hoặc được yêu thích nhất. Dùng khi khách hỏi "có gì bán chạy", "sản phẩm nổi bật", "best seller", "đề xuất cho tôi".',
      parameters: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description: 'Số lượng sản phẩm muốn lấy (mặc định 5)'
          }
        },
        required: []
      }
    }
  }
]

// ─── Tool Executors ──────────────────────────────────────────────────────────

/**
 * Tìm kiếm sản phẩm theo từ khoá
 */
async function searchProducts({ keyword }) {
  try {
    const limit = 5

    // Build query
    const query = {
      deleted: false,
      status: 'active'
    }

    // Text search thông minh (Fuzzy & Multi-word AND)
    if (keyword) {
      // 1. Phân mảnh (Tokenize) và loại bỏ filler words
      let cleanedKeyword = keyword
        .replace(/(tài khoản|acc|gói|mua|bán|giá rẻ|cần tìm|bản quyền|tháng|năm|nâng cấp|chính chủ)/gi, ' ')
        .replace(/chatgpt/gi, 'chat gpt')
        .replace(/canvapro/gi, 'canva pro')
        .trim()

      if (!cleanedKeyword) cleanedKeyword = keyword // fallback nếu user gõ toàn filler words

      const terms = cleanedKeyword.split(/\s+/).filter(t => t.length > 0)
      
      if (terms.length > 0) {
        query.$and = terms.map(term => {
          const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          return {
            $or: [
              { title: { $regex: escaped, $options: 'i' } },
              { titleNoAccent: { $regex: escaped, $options: 'i' } }
            ]
          }
        })
      } else {
        const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        query.$or = [
          { title: { $regex: escaped, $options: 'i' } },
          { titleNoAccent: { $regex: escaped, $options: 'i' } }
        ]
      }
    }

    const products = await Product
      .find(query)
      .select('title price discountPercentage stock thumbnail slug features rate soldQuantity')
      .sort({ soldQuantity: -1 }) // Ưu tiên sản phẩm bán chạy
      .limit(limit)
      .lean()

    if (products.length === 0) {
      return JSON.stringify({
        found: false,
        message: `Không tìm thấy sản phẩm nào với từ khoá "${keyword}".`,
        suggestion: 'Thử tìm với từ khoá khác hoặc xem danh mục sản phẩm trên trang chủ.'
      })
    }

    const results = products.map(p => {
      const finalPrice = p.discountPercentage
        ? Math.round(p.price * (1 - p.discountPercentage / 100))
        : p.price
      return {
        name: p.title,
        slug: p.slug,
        originalPrice: formatPrice(p.price),
        discount: p.discountPercentage ? `${p.discountPercentage}%` : null,
        finalPrice: formatPrice(finalPrice),
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
      products: results
    })
  } catch (err) {
    logger.error('[AI Tool] searchProducts error:', err.message)
    return JSON.stringify({ found: false, error: 'Lỗi khi tìm kiếm sản phẩm. Vui lòng thử lại.' })
  }
}

/**
 * Lấy chi tiết sản phẩm
 */
async function getProductDetail({ slug }) {
  try {
    // 1. Tìm chính xác bằng slug
    let product = await Product.findOne({ slug, deleted: false }).populate('productCategory', 'title').lean()

    // 2. Fallback: tìm bằng regex exact title
    if (!product) {
      const escaped = slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      product = await Product.findOne({
        $or: [
          { title: { $regex: escaped, $options: 'i' } },
          { titleNoAccent: { $regex: escaped, $options: 'i' } }
        ],
        deleted: false
      }).populate('productCategory', 'title').lean()
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
        product = await Product.findOne(query).populate('productCategory', 'title').lean()
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

/**
 * Kiểm tra trạng thái đơn hàng
 */
async function checkOrderStatus({ orderId }) {
  try {
    // Sanitize input — chỉ lấy phần ID (bỏ ký tự thừa #, ORD, prefix...)
    const cleanId = orderId.replace(/^[#ORDord\s-]*/g, '').trim()

    // Thử tìm bằng _id (MongoDB ObjectId)
    let order = null
    if (/^[0-9a-fA-F]{24}$/.test(cleanId)) {
      order = await Order.findOne({ _id: cleanId, isDeleted: false }).lean()
    }

    // Nếu không tìm được, thử tìm đuôi ID (khách thường chỉ nhớ 4-6 ký tự cuối)
    if (!order && cleanId.length >= 4) {
      order = await Order.findOne({
        isDeleted: false
      }).sort({ createdAt: -1 }).lean()

      // Kiểm tra đuôi ID
      if (order && !order._id.toString().endsWith(cleanId.toLowerCase())) {
        order = null
      }
    }

    if (!order) {
      return JSON.stringify({
        found: false,
        message: `Không tìm thấy đơn hàng với mã "${orderId}". Bạn vui lòng kiểm tra lại mã đơn hàng nhé.`,
        suggestion: 'Bạn có thể xem đơn hàng trong mục "Đơn hàng của tôi" khi đã đăng nhập.'
      })
    }

    const statusMap = {
      pending: 'Chờ xác nhận',
      confirmed: 'Đã xác nhận',
      shipping: 'Đang giao hàng',
      completed: 'Đã hoàn thành',
      cancelled: 'Đã huỷ'
    }

    const paymentStatusMap = {
      pending: 'Chưa thanh toán',
      paid: 'Đã thanh toán',
      failed: 'Thanh toán thất bại'
    }

    const itemsSummary = (order.orderItems || []).map(item => ({
      name: item.name,
      qty: item.quantity,
      price: formatPrice(item.price)
    }))

    return JSON.stringify({
      found: true,
      order: {
        id: order._id.toString(),
        status: statusMap[order.status] || order.status,
        rawStatus: order.status,
        paymentStatus: paymentStatusMap[order.paymentStatus] || order.paymentStatus,
        paymentMethod: order.paymentMethod,
        total: formatPrice(order.total),
        items: itemsSummary,
        itemCount: itemsSummary.length,
        createdAt: new Date(order.createdAt).toLocaleDateString('vi-VN'),
        canCancel: order.status === 'pending'
      }
    })
  } catch (err) {
    logger.error('[AI Tool] checkOrderStatus error:', err.message)
    return JSON.stringify({ found: false, error: 'Lỗi khi tra cứu đơn hàng.' })
  }
}

/**
 * Lấy danh sách sản phẩm đang giảm giá / Flash Sale
 */
async function getFlashSales(args) {
  try {
    const maxLimit = 5

    // Lấy sản phẩm có discountPercentage > 0, ưu tiên giảm giá cao nhất
    const products = await Product
      .find({
        deleted: false,
        status: 'active',
        discountPercentage: { $gt: 0 },
        stock: { $gt: 0 }
      })
      .select('title price discountPercentage stock thumbnail slug soldQuantity')
      .sort({ discountPercentage: -1 })
      .limit(maxLimit)
      .lean()

    if (products.length === 0) {
      return JSON.stringify({
        found: false,
        message: 'Hiện tại không có chương trình giảm giá nào đang diễn ra.'
      })
    }

    const results = products.map(p => {
      const finalPrice = Math.round(p.price * (1 - p.discountPercentage / 100))
      return {
        name: p.title,
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
async function browseByCategory({ categoryKeyword }) {
  try {
    const keyword = (categoryKeyword || '').trim()
    if (!keyword) {
      return JSON.stringify({ found: false, message: 'Vui lòng cho mình biết bạn quan tâm đến lĩnh vực nào?' })
    }

    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

    // Tìm danh mục khớp keyword
    const categories = await ProductCategory.find({
      $or: [
        { title: { $regex: escaped, $options: 'i' } },
        { description: { $regex: escaped, $options: 'i' } }
      ],
      deleted: false
    }).select('_id title slug').lean()

    let products = []

    if (categories.length > 0) {
      // Có danh mục khớp → lấy sản phẩm thuộc danh mục
      const categoryIds = categories.map(c => c._id)
      products = await Product
        .find({ productCategory: { $in: categoryIds }, deleted: false, status: 'active' })
        .select('title price discountPercentage stock slug soldQuantity rate')
        .sort({ soldQuantity: -1 })
        .limit(6)
        .lean()
    }

    // Fallback: tìm trong description hoặc features của sản phẩm
    if (products.length === 0) {
      products = await Product
        .find({
          deleted: false,
          status: 'active',
          $or: [
            { description: { $regex: escaped, $options: 'i' } },
            { features: { $regex: escaped, $options: 'i' } },
            { title: { $regex: escaped, $options: 'i' } }
          ]
        })
        .select('title price discountPercentage stock slug soldQuantity rate')
        .sort({ soldQuantity: -1 })
        .limit(6)
        .lean()
    }

    if (products.length === 0) {
      // Gợi ý danh mục có sẵn
      const allCats = await ProductCategory.find({ deleted: false }).select('title').limit(10).lean()
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
 * Lấy sản phẩm bán chạy / nổi bật
 */
async function getPopularProducts({ limit } = {}) {
  try {
    const max = Math.min(limit || 5, 10)

    const [bestsellers, featured] = await Promise.all([
      Product.find({ deleted: false, status: 'active' })
        .select('title price discountPercentage stock slug soldQuantity rate')
        .sort({ soldQuantity: -1 })
        .limit(max)
        .lean(),
      Product.find({ deleted: false, status: 'active', isFeatured: true })
        .select('title price discountPercentage stock slug soldQuantity rate')
        .sort({ soldQuantity: -1 })
        .limit(max)
        .lean()
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

function formatPrice(amount) {
  if (amount == null) return '0₫'
  return new Intl.NumberFormat('vi-VN').format(amount) + '₫'
}

// ─── Tool Registry (map name → executor function) ───────────────────────────

const toolExecutors = {
  searchProducts,
  getProductDetail,
  checkOrderStatus,
  getFlashSales,
  browseByCategory,
  getPopularProducts
}

/**
 * Thực thi một tool call từ AI response
 * @param {string} toolName - Tên hàm
 * @param {Object} args - Tham số (đã parse từ JSON)
 * @returns {string} Kết quả dạng JSON string
 */
async function executeTool(toolName, args) {
  const executor = toolExecutors[toolName]
  if (!executor) {
    logger.warn(`[AI Tool] Unknown tool: ${toolName}`)
    return JSON.stringify({ error: `Không tìm thấy công cụ "${toolName}".` })
  }

  logger.info(`[AI Tool] Executing: ${toolName}(${JSON.stringify(args)})`)
  const startTime = Date.now()
  const result = await executor(args || {})
  const elapsed = Date.now() - startTime
  logger.info(`[AI Tool] ${toolName} completed in ${elapsed}ms`)

  return result
}

module.exports = {
  toolDefinitions,
  executeTool
}
