/**
 * AI Tools — Function Calling definitions & executors
 * Cho phép AI chatbot truy vấn Database để trả lời khách hàng
 *
 * Hỗ trợ: searchProduct, getProductDetail, checkOrderStatus, getFlashSales
 */

const productRepository = require('../../repositories/product.repository')
const productCategoryRepository = require('../../repositories/productCategory.repository')
const orderRepository = require('../../repositories/order.repository')
const cartRepository = require('../../repositories/cart.repository')
const promoCodeRepository = require('../../repositories/promoCode.repository')
const reviewRepository = require('../../repositories/review.repository')
const logger = require('../../../../config/logger')

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000'
const MAX_CART_UNIQUE_ITEMS = 50

// ─── Tool Registry (hard-code trong backend, admin chỉ bật/tắt quyền dùng) ───

const TOOL_REGISTRY = [
  {
    name: 'searchProducts',
    label: 'Tìm sản phẩm',
    description: 'Tìm kiếm sản phẩm trên SmartMall theo từ khoá. Trả về danh sách sản phẩm gồm tên, giá, tồn kho, link.',
    group: 'catalog',
    riskLevel: 'safe',
    requiresConfirmation: false,
    defaultEnabled: true,
    endpoint: 'productService.searchProducts',
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
  },
  {
    name: 'getProductDetail',
    label: 'Chi tiết sản phẩm',
    description: 'Lấy thông tin chi tiết của một sản phẩm cụ thể. Ưu tiên dùng slug từ kết quả searchProducts. Nếu không có slug, có thể dùng tên sản phẩm.',
    group: 'catalog',
    riskLevel: 'safe',
    requiresConfirmation: false,
    defaultEnabled: true,
    endpoint: 'productService.getProductDetail',
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
  },
  {
    name: 'checkOrderStatus',
    label: 'Tra cứu đơn hàng',
    description: 'Kiểm tra trạng thái đơn hàng theo mã đơn hàng (Order ID). Dùng khi khách hỏi về tình trạng đơn hàng, giao hàng, thanh toán.',
    group: 'orders',
    riskLevel: 'safe',
    requiresConfirmation: false,
    defaultEnabled: true,
    endpoint: 'orderService.checkOrderStatus',
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
  },
  {
    name: 'getFlashSales',
    label: 'Flash sale',
    description: 'Lấy danh sách sản phẩm đang khuyến mãi giảm giá.',
    group: 'promotions',
    riskLevel: 'safe',
    requiresConfirmation: false,
    defaultEnabled: true,
    endpoint: 'productService.getFlashSales',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'getAvailablePromoCodes',
    label: 'Mã giảm giá khả dụng',
    description: 'Lấy danh sách mã giảm giá công khai hoặc mã dành riêng cho khách đang chat, còn hiệu lực và chưa hết lượt. Có thể lọc theo giá trị đơn tạm tính.',
    group: 'promotions',
    riskLevel: 'safe',
    requiresConfirmation: false,
    defaultEnabled: true,
    endpoint: 'promoCodeService.getAvailablePromoCodes',
    parameters: {
      type: 'object',
      properties: {
        subtotal: {
          type: 'number',
          description: 'Giá trị đơn tạm tính để lọc các mã áp dụng được'
        }
      },
      required: []
    }
  },
  {
    name: 'checkPromoCode',
    label: 'Kiểm tra mã giảm giá',
    description: 'Kiểm tra một mã giảm giá có còn hợp lệ với khách đang chat hay không. Nếu có subtotal thì tính luôn mức giảm dự kiến.',
    group: 'promotions',
    riskLevel: 'safe',
    requiresConfirmation: false,
    defaultEnabled: true,
    endpoint: 'promoCodeService.checkPromoCode',
    parameters: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          description: 'Mã giảm giá khách muốn kiểm tra'
        },
        subtotal: {
          type: 'number',
          description: 'Giá trị đơn tạm tính để tính mức giảm'
        }
      },
      required: ['code']
    }
  },
  {
    name: 'getCart',
    label: 'Xem giỏ hàng',
    description: 'Lấy giỏ hàng hiện tại của khách đang chat, gồm sản phẩm, số lượng, giá backend tính và tổng tạm tính.',
    group: 'cart',
    riskLevel: 'safe',
    requiresConfirmation: false,
    defaultEnabled: true,
    endpoint: 'cartService.getCart',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'addToCart',
    label: 'Thêm vào giỏ',
    description: 'Thêm sản phẩm vào giỏ hàng của khách đang chat. Dùng productId nếu đã có từ tool trước, hoặc productQuery nếu mới chỉ biết tên/slug.',
    group: 'cart',
    riskLevel: 'write',
    requiresConfirmation: false,
    defaultEnabled: true,
    endpoint: 'cartService.addToCart',
    parameters: {
      type: 'object',
      properties: {
        productId: {
          type: 'string',
          description: 'MongoDB ObjectId của sản phẩm'
        },
        productQuery: {
          type: 'string',
          description: 'Tên hoặc slug sản phẩm nếu chưa có productId'
        },
        quantity: {
          type: 'number',
          description: 'Số lượng muốn thêm vào giỏ, mặc định 1'
        }
      },
      required: []
    }
  },
  {
    name: 'updateCartQuantity',
    label: 'Cập nhật số lượng giỏ',
    description: 'Cập nhật số lượng của một sản phẩm đang có trong giỏ hàng.',
    group: 'cart',
    riskLevel: 'write',
    requiresConfirmation: false,
    defaultEnabled: true,
    endpoint: 'cartService.updateCartQuantity',
    parameters: {
      type: 'object',
      properties: {
        productId: {
          type: 'string',
          description: 'MongoDB ObjectId của sản phẩm trong giỏ'
        },
        productQuery: {
          type: 'string',
          description: 'Tên hoặc slug sản phẩm trong giỏ nếu chưa có productId'
        },
        quantity: {
          type: 'number',
          description: 'Số lượng mới cần cập nhật'
        }
      },
      required: ['quantity']
    }
  },
  {
    name: 'removeFromCart',
    label: 'Xóa khỏi giỏ',
    description: 'Xóa một sản phẩm khỏi giỏ hàng của khách đang chat.',
    group: 'cart',
    riskLevel: 'write',
    requiresConfirmation: false,
    defaultEnabled: true,
    endpoint: 'cartService.removeFromCart',
    parameters: {
      type: 'object',
      properties: {
        productId: {
          type: 'string',
          description: 'MongoDB ObjectId của sản phẩm trong giỏ'
        },
        productQuery: {
          type: 'string',
          description: 'Tên hoặc slug sản phẩm trong giỏ nếu chưa có productId'
        }
      },
      required: []
    }
  },
  {
    name: 'validateCart',
    label: 'Kiểm tra giỏ hàng',
    description: 'Kiểm tra giỏ hàng hiện tại có sản phẩm hết hàng, vượt tồn kho, giá thay đổi hoặc mã giảm giá đang nhập có hợp lệ hay không.',
    group: 'cart',
    riskLevel: 'safe',
    requiresConfirmation: false,
    defaultEnabled: true,
    endpoint: 'cartService.validateCart',
    parameters: {
      type: 'object',
      properties: {
        promoCode: {
          type: 'string',
          description: 'Mã giảm giá muốn kiểm tra cùng với giỏ hàng hiện tại'
        }
      },
      required: []
    }
  },
  {
    name: 'clearCart',
    label: 'Xóa toàn bộ giỏ',
    description: 'Xóa toàn bộ giỏ hàng của khách đang chat. Chỉ thực thi sau khi khách xác nhận rõ ràng bằng confirmed=true.',
    group: 'cart',
    riskLevel: 'dangerous',
    requiresConfirmation: true,
    confirmationMessage: 'Hành động này sẽ xóa toàn bộ giỏ hàng hiện tại. Bạn có chắc muốn tiếp tục không?',
    defaultEnabled: true,
    endpoint: 'cartService.clearCart',
    parameters: {
      type: 'object',
      properties: {
        confirmed: {
          type: 'boolean',
          description: 'Phải là true sau khi khách đã xác nhận rõ ràng muốn xóa toàn bộ giỏ'
        }
      },
      required: []
    }
  },
  {
    name: 'browseByCategory',
    label: 'Duyệt theo danh mục',
    description: 'Duyệt sản phẩm theo danh mục/chủ đề. Dùng khi khách hàng hỏi chung chung về một lĩnh vực hoặc muốn xem gợi ý.',
    group: 'catalog',
    riskLevel: 'safe',
    requiresConfirmation: false,
    defaultEnabled: true,
    endpoint: 'categoryService.browseByCategory',
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
  },
  {
    name: 'getPopularProducts',
    label: 'Sản phẩm nổi bật',
    description: 'Lấy danh sách sản phẩm bán chạy nhất hoặc được yêu thích nhất. Dùng khi khách hỏi về best seller hoặc muốn gợi ý nhanh.',
    group: 'catalog',
    riskLevel: 'safe',
    requiresConfirmation: false,
    defaultEnabled: true,
    endpoint: 'productService.getPopularProducts',
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
  },
  {
    name: 'getProductReviewSummary',
    label: 'Tóm tắt đánh giá sản phẩm',
    description: 'Lấy điểm đánh giá trung bình, tổng số review và một vài nhận xét nổi bật của sản phẩm theo tên hoặc slug.',
    group: 'reviews',
    riskLevel: 'safe',
    requiresConfirmation: false,
    defaultEnabled: true,
    endpoint: 'reviewService.getProductReviewSummary',
    parameters: {
      type: 'object',
      properties: {
        productQuery: {
          type: 'string',
          description: 'Tên hoặc slug sản phẩm cần xem đánh giá'
        }
      },
      required: ['productQuery']
    }
  }
]

function buildToolSettingsMap(toolSettings = []) {
  return new Map(
    (Array.isArray(toolSettings) ? toolSettings : [])
      .filter(item => item && typeof item.name === 'string')
      .map(item => [item.name, item.enabled !== false])
  )
}

function getToolRegistry(toolSettings = []) {
  const toolSettingsMap = buildToolSettingsMap(toolSettings)

  return TOOL_REGISTRY.map(tool => ({
    ...tool,
    enabled: toolSettingsMap.has(tool.name)
      ? toolSettingsMap.get(tool.name)
      : tool.defaultEnabled
  }))
}

function getToolDefinitions(toolSettings = []) {
  return getToolRegistry(toolSettings)
    .filter(tool => tool.enabled)
    .map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters
      }
    }))
}

function getToolByName(toolName) {
  return TOOL_REGISTRY.find(tool => tool.name === toolName) || null
}

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

    const products = await productRepository.findByQuery(query, {
      select: 'title price discountPercentage stock thumbnail slug features rate soldQuantity',
      sort: { soldQuantity: -1 },
      limit,
      lean: true
    })

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
        productId: p._id.toString(),
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
      order = await orderRepository.findOne({ _id: cleanId, isDeleted: false }, { lean: true })
    }

    // Nếu không tìm được, thử tìm đuôi ID (khách thường chỉ nhớ 4-6 ký tự cuối)
    if (!order && cleanId.length >= 4) {
      order = await orderRepository.findOne({
        isDeleted: false
      }, {
        sort: { createdAt: -1 },
        lean: true
      })

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

async function getCart(args = {}, context = {}) {
  try {
    const userId = normalizeUserId(context)
    if (!userId) {
      return JSON.stringify({
        found: false,
        requiresLogin: true,
        message: 'Khach can dang nhap de xem gio hang.'
      })
    }

    const cart = await buildCartSnapshot(userId)

    return JSON.stringify({
      found: true,
      empty: cart.distinctItemCount === 0,
      message: cart.distinctItemCount === 0 ? 'Gio hang hien dang trong.' : null,
      cart
    })
  } catch (err) {
    logger.error('[AI Tool] getCart error:', err.message)
    return JSON.stringify({ found: false, error: 'Loi khi lay gio hang hien tai.' })
  }
}

async function addToCart({ productId, productQuery, quantity = 1 } = {}, context = {}) {
  try {
    const userId = normalizeUserId(context)
    if (!userId) {
      return JSON.stringify({
        success: false,
        requiresLogin: true,
        message: 'Khach can dang nhap truoc khi them vao gio hang.'
      })
    }

    const normalizedQuantity = normalizeQuantity(quantity, 1)
    if (!normalizedQuantity) {
      return JSON.stringify({
        success: false,
        message: 'So luong them vao gio hang khong hop le.'
      })
    }

    const product = await resolveProductForCartInput({ productId, productQuery })
    if (!isSellableProduct(product)) {
      return JSON.stringify({
        success: false,
        message: `Khong tim thay san pham "${productQuery || productId || ''}" de them vao gio hang.`
      })
    }

    if (Number(product.stock || 0) <= 0) {
      return JSON.stringify({
        success: false,
        message: `${product.title} hien da het hang.`,
        stock: product.stock || 0
      })
    }

    let cart = await cartRepository.findByUserId(userId)
    if (!cart) cart = await cartRepository.createForUser(userId)

    const existingIndex = cart.items.findIndex(item => item.productId.equals(product._id))
    if (existingIndex >= 0) {
      const nextQuantity = Number(cart.items[existingIndex].quantity || 0) + normalizedQuantity
      if (nextQuantity > Number(product.stock || 0)) {
        return JSON.stringify({
          success: false,
          message: `So luong yeu cau vuot ton kho hien co cua ${product.title}.`,
          stock: product.stock || 0
        })
      }

      cart.items[existingIndex].quantity = nextQuantity
      const existingItem = cart.items[existingIndex]
      cart.items.splice(existingIndex, 1)
      cart.items.unshift(existingItem)
    } else {
      if (cart.items.length >= MAX_CART_UNIQUE_ITEMS) {
        return JSON.stringify({
          success: false,
          message: `Gio hang chi chua toi da ${MAX_CART_UNIQUE_ITEMS} san pham khac nhau.`,
          maxUniqueItems: MAX_CART_UNIQUE_ITEMS
        })
      }

      if (normalizedQuantity > Number(product.stock || 0)) {
        return JSON.stringify({
          success: false,
          message: `So luong yeu cau vuot ton kho hien co cua ${product.title}.`,
          stock: product.stock || 0
        })
      }

      cart.items.unshift({
        productId: product._id,
        name: product.title,
        price: calculateEffectiveProductPrice(product),
        image: product.thumbnail,
        quantity: normalizedQuantity,
        discountPercentage: product.discountPercentage || 0,
        slug: product.slug
      })
    }

    cart.updatedAt = new Date()
    await cartRepository.save(cart)

    return JSON.stringify({
      success: true,
      message: `Da them ${normalizedQuantity} x ${product.title} vao gio hang.`,
      cart: await buildCartSnapshot(userId)
    })
  } catch (err) {
    logger.error('[AI Tool] addToCart error:', err.message)
    return JSON.stringify({ success: false, error: 'Loi khi them san pham vao gio hang.' })
  }
}

async function updateCartQuantity({ productId, productQuery, quantity } = {}, context = {}) {
  try {
    const userId = normalizeUserId(context)
    if (!userId) {
      return JSON.stringify({
        success: false,
        requiresLogin: true,
        message: 'Khach can dang nhap truoc khi cap nhat gio hang.'
      })
    }

    const normalizedQuantity = normalizeQuantity(quantity)
    if (!normalizedQuantity) {
      return JSON.stringify({
        success: false,
        message: 'So luong moi khong hop le.'
      })
    }

    const cart = await cartRepository.findByUserId(userId)
    if (!cart || !Array.isArray(cart.items) || cart.items.length === 0) {
      return JSON.stringify({
        success: false,
        message: 'Gio hang hien dang trong.'
      })
    }

    const product = await resolveProductForCartInput({ productId, productQuery })
    const cartItemIndex = findCartItemIndex(cart.items, { productId, productQuery, product })
    if (cartItemIndex < 0) {
      return JSON.stringify({
        success: false,
        message: 'Khong tim thay san pham can cap nhat trong gio hang.'
      })
    }

    const targetItem = cart.items[cartItemIndex]
    const targetProduct = product || await productRepository.findById(targetItem.productId, { lean: true })

    if (!isSellableProduct(targetProduct)) {
      return JSON.stringify({
        success: false,
        message: 'San pham nay khong con ban tren he thong.'
      })
    }

    if (normalizedQuantity > Number(targetProduct.stock || 0)) {
      return JSON.stringify({
        success: false,
        message: `So luong yeu cau vuot ton kho hien co cua ${targetProduct.title}.`,
        stock: targetProduct.stock || 0
      })
    }

    cart.items[cartItemIndex].quantity = normalizedQuantity
    cart.updatedAt = new Date()
    await cartRepository.save(cart)

    return JSON.stringify({
      success: true,
      message: `Da cap nhat ${targetProduct.title} thanh ${normalizedQuantity}.`,
      cart: await buildCartSnapshot(userId)
    })
  } catch (err) {
    logger.error('[AI Tool] updateCartQuantity error:', err.message)
    return JSON.stringify({ success: false, error: 'Loi khi cap nhat so luong gio hang.' })
  }
}

async function removeFromCart({ productId, productQuery } = {}, context = {}) {
  try {
    const userId = normalizeUserId(context)
    if (!userId) {
      return JSON.stringify({
        success: false,
        requiresLogin: true,
        message: 'Khach can dang nhap truoc khi xoa khoi gio hang.'
      })
    }

    const cart = await cartRepository.findByUserId(userId)
    if (!cart || !Array.isArray(cart.items) || cart.items.length === 0) {
      return JSON.stringify({
        success: false,
        message: 'Gio hang hien dang trong.'
      })
    }

    const product = await resolveProductForCartInput({ productId, productQuery })
    const cartItemIndex = findCartItemIndex(cart.items, { productId, productQuery, product })
    if (cartItemIndex < 0) {
      return JSON.stringify({
        success: false,
        message: 'Khong tim thay san pham can xoa trong gio hang.'
      })
    }

    const removedItem = cart.items[cartItemIndex]
    const removedName = removedItem.name || product?.title || productQuery || productId

    cart.items.splice(cartItemIndex, 1)
    cart.updatedAt = new Date()
    await cartRepository.save(cart)

    return JSON.stringify({
      success: true,
      message: `Da xoa ${removedName} khoi gio hang.`,
      cart: await buildCartSnapshot(userId)
    })
  } catch (err) {
    logger.error('[AI Tool] removeFromCart error:', err.message)
    return JSON.stringify({ success: false, error: 'Loi khi xoa san pham khoi gio hang.' })
  }
}

async function validateCart({ promoCode } = {}, context = {}) {
  try {
    const userId = normalizeUserId(context)
    if (!userId) {
      return JSON.stringify({
        valid: false,
        requiresLogin: true,
        message: 'Khach can dang nhap de kiem tra gio hang.'
      })
    }

    const cart = await buildCartSnapshot(userId, { promoCode })

    return JSON.stringify({
      valid: !cart.hasIssues,
      message: cart.hasIssues
        ? 'Gio hang hien co mot vai van de can xu ly truoc khi dat hang.'
        : 'Gio hang hop le va san sang cho buoc tiep theo.',
      cart
    })
  } catch (err) {
    logger.error('[AI Tool] validateCart error:', err.message)
    return JSON.stringify({ valid: false, error: 'Loi khi kiem tra gio hang.' })
  }
}

async function clearCart(args = {}, context = {}) {
  try {
    const userId = normalizeUserId(context)
    if (!userId) {
      return JSON.stringify({
        success: false,
        requiresLogin: true,
        message: 'Khach can dang nhap truoc khi xoa gio hang.'
      })
    }

    const cart = await cartRepository.findByUserId(userId)
    if (!cart || !Array.isArray(cart.items) || cart.items.length === 0) {
      return JSON.stringify({
        success: true,
        message: 'Gio hang da trong san.'
      })
    }

    cart.items = []
    cart.updatedAt = new Date()
    await cartRepository.save(cart)

    return JSON.stringify({
      success: true,
      message: 'Da xoa toan bo gio hang.',
      cart: await buildCartSnapshot(userId)
    })
  } catch (err) {
    logger.error('[AI Tool] clearCart error:', err.message)
    return JSON.stringify({ success: false, error: 'Loi khi xoa toan bo gio hang.' })
  }
}

async function buildCartSnapshot(userId, { promoCode } = {}) {
  const cart = await cartRepository.findByUserId(userId, { lean: true })

  if (!cart || !Array.isArray(cart.items) || cart.items.length === 0) {
    return {
      cartId: cart?._id?.toString() || null,
      itemCount: 0,
      distinctItemCount: 0,
      remainingSlots: MAX_CART_UNIQUE_ITEMS,
      subtotal: 0,
      subtotalFormatted: formatPrice(0),
      items: [],
      issues: [],
      hasIssues: false,
      promoValidation: null
    }
  }

  const productIds = cart.items.map(item => item.productId)
  const products = await productRepository.findByQuery(
    { _id: { $in: productIds } },
    {
      select: 'title price discountPercentage stock thumbnail slug status deleted',
      lean: true
    }
  )

  const productMap = new Map(products.map(product => [product._id.toString(), product]))
  const items = cart.items.map((item, index) => {
    const product = productMap.get(item.productId.toString()) || null
    const storedUnitPrice = getStoredCartUnitPrice(item)
    const currentUnitPrice = product ? calculateEffectiveProductPrice(product) : storedUnitPrice
    const displayUnitPrice = item.isFlashSale && item.salePrice != null ? Number(item.salePrice) : currentUnitPrice
    const quantity = Number(item.quantity || 0)
    const itemIssues = []

    if (!isSellableProduct(product)) {
      itemIssues.push({
        code: 'unavailable',
        message: 'San pham khong con ban tren he thong.'
      })
    } else {
      if (Number(product.stock || 0) <= 0) {
        itemIssues.push({
          code: 'out_of_stock',
          message: 'San pham hien da het hang.'
        })
      }

      if (quantity > Number(product.stock || 0)) {
        itemIssues.push({
          code: 'quantity_exceeds_stock',
          message: `So luong trong gio (${quantity}) vuot ton kho hien co (${product.stock || 0}).`
        })
      }

      if (!item.isFlashSale && storedUnitPrice !== currentUnitPrice) {
        itemIssues.push({
          code: 'price_changed',
          message: `Gia san pham da thay doi tu ${formatPrice(storedUnitPrice)} thanh ${formatPrice(currentUnitPrice)}.`
        })
      }
    }

    return {
      line: index + 1,
      productId: item.productId.toString(),
      slug: product?.slug || item.slug || null,
      name: product?.title || item.name || 'San pham khong xac dinh',
      quantity,
      stock: product?.stock ?? 0,
      inStock: !!product && Number(product.stock || 0) > 0,
      unitPrice: displayUnitPrice,
      unitPriceFormatted: formatPrice(displayUnitPrice),
      currentUnitPrice,
      currentUnitPriceFormatted: formatPrice(currentUnitPrice),
      storedUnitPrice,
      storedUnitPriceFormatted: formatPrice(storedUnitPrice),
      lineTotal: displayUnitPrice * quantity,
      lineTotalFormatted: formatPrice(displayUnitPrice * quantity),
      image: product?.thumbnail || item.image || null,
      discountPercentage: product?.discountPercentage ?? item.discountPercentage ?? 0,
      issues: itemIssues
    }
  })

  const issues = items.flatMap(item =>
    item.issues.map(issue => ({
      ...issue,
      productId: item.productId,
      name: item.name
    }))
  )

  if (items.length > MAX_CART_UNIQUE_ITEMS) {
    issues.push({
      code: 'cart_unique_limit_exceeded',
      message: `Gio hang dang vuot gioi han ${MAX_CART_UNIQUE_ITEMS} san pham khac nhau.`
    })
  }

  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0)
  let promoValidation = null

  if (typeof promoCode === 'string' && promoCode.trim()) {
    promoValidation = parseToolPayload(
      await checkPromoCode({ code: promoCode.trim(), subtotal }, { userId })
    )

    if (promoValidation?.valid === false) {
      issues.push({
        code: 'promo_invalid',
        message: promoValidation.message || 'Ma giam gia khong hop le voi gio hang hien tai.'
      })
    }
  }

  return {
    cartId: cart._id?.toString() || null,
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    distinctItemCount: items.length,
    remainingSlots: Math.max(MAX_CART_UNIQUE_ITEMS - items.length, 0),
    subtotal,
    subtotalFormatted: formatPrice(subtotal),
    items,
    issues,
    hasIssues: issues.length > 0,
    promoValidation
  }
}

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

async function checkPromoCode({ code, subtotal } = {}, context = {}) {
  try {
    const normalizedCode = String(code || '').trim().toUpperCase()
    if (!normalizedCode) {
      return JSON.stringify({
        valid: false,
        message: 'Vui lòng cung cấp mã giảm giá cần kiểm tra.'
      })
    }

    const userId = normalizeUserId(context)
    const normalizedSubtotal = normalizeSubtotal(subtotal)
    const promo = await promoCodeRepository.findOne({ code: normalizedCode, isActive: true }, { lean: true })

    if (!promo) {
      return JSON.stringify({
        valid: false,
        message: `Không tìm thấy mã ${normalizedCode} hoặc mã này không còn hoạt động.`
      })
    }

    if (promo.userId && String(promo.userId) !== String(userId || '')) {
      return JSON.stringify({
        valid: false,
        message: `Mã ${normalizedCode} không áp dụng cho tài khoản đang chat.`,
        promo: buildPromoPayload(promo)
      })
    }

    if (isPromoExpired(promo)) {
      return JSON.stringify({
        valid: false,
        message: `Mã ${normalizedCode} đã hết hạn.`,
        promo: buildPromoPayload(promo)
      })
    }

    if (isPromoExhausted(promo)) {
      return JSON.stringify({
        valid: false,
        message: `Mã ${normalizedCode} đã hết lượt sử dụng.`,
        promo: buildPromoPayload(promo)
      })
    }

    if (hasUserUsedPromo(promo, userId)) {
      return JSON.stringify({
        valid: false,
        message: `Tài khoản này đã dùng mã ${normalizedCode} rồi.`,
        promo: buildPromoPayload(promo)
      })
    }

    if (normalizedSubtotal === null) {
      return JSON.stringify({
        valid: true,
        needsSubtotal: true,
        message: `Mã ${normalizedCode} đang hoạt động. Mình cần tổng tiền tạm tính để tính chính xác mức giảm.`,
        promo: buildPromoPayload(promo)
      })
    }

    if (normalizedSubtotal < Number(promo.minOrder || 0)) {
      return JSON.stringify({
        valid: false,
        message: `Mã ${normalizedCode} yêu cầu đơn tối thiểu ${formatPrice(promo.minOrder || 0)}.`,
        promo: buildPromoPayload(promo, { subtotal: normalizedSubtotal })
      })
    }

    const discount = calculatePromoDiscount(promo, normalizedSubtotal)

    return JSON.stringify({
      valid: true,
      subtotal: normalizedSubtotal,
      subtotalFormatted: formatPrice(normalizedSubtotal),
      discount,
      discountFormatted: formatPrice(discount),
      estimatedTotalFormatted: formatPrice(Math.max(0, normalizedSubtotal - discount)),
      message: `Mã ${normalizedCode} áp dụng được cho đơn hiện tại.`,
      promo: buildPromoPayload(promo, { subtotal: normalizedSubtotal })
    })
  } catch (err) {
    logger.error('[AI Tool] checkPromoCode error:', err.message)
    return JSON.stringify({ valid: false, error: 'Lỗi khi kiểm tra mã giảm giá.' })
  }
}

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

function escapeRegExp(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function normalizeSearchTerms(rawValue = '') {
  return String(rawValue)
    .replace(/(tài khoản|acc|gói|mua|bán|giá rẻ|cần tìm|bản quyền|tháng|năm|nâng cấp|chính chủ)/gi, ' ')
    .replace(/chatgpt/gi, 'chat gpt')
    .replace(/canvapro/gi, 'canva pro')
    .trim()
}

async function findProductByQuery(productQuery) {
  const rawQuery = String(productQuery || '').trim()
  if (!rawQuery) return null

  let product = await productRepository.findOne(
    { slug: rawQuery, deleted: false },
    { populate: { path: 'productCategory', select: 'title' }, lean: true }
  )
  if (product) return product

  const exactRegex = escapeRegExp(rawQuery)
  product = await productRepository.findOne({
    deleted: false,
    $or: [
      { title: { $regex: exactRegex, $options: 'i' } },
      { titleNoAccent: { $regex: exactRegex, $options: 'i' } }
    ]
  }, {
    populate: { path: 'productCategory', select: 'title' },
    lean: true
  })
  if (product) return product

  const cleaned = normalizeSearchTerms(rawQuery)
  const terms = cleaned.split(/\s+/).filter(term => term.length > 1)
  if (terms.length === 0) return null

  return productRepository.findOne({
    deleted: false,
    $and: terms.map(term => {
      const escaped = escapeRegExp(term)
      return {
        $or: [
          { title: { $regex: escaped, $options: 'i' } },
          { titleNoAccent: { $regex: escaped, $options: 'i' } }
        ]
      }
    })
  }, {
    populate: { path: 'productCategory', select: 'title' },
    lean: true
  })
}

function normalizeUserId(context = {}) {
  return context?.userId
    || context?.customerInfo?.userId
    || null
}

function isSellableProduct(product) {
  return !!product && product.deleted !== true && product.status === 'active'
}

function normalizeQuantity(quantity, fallback = null) {
  const normalized = Number(quantity)
  if (!Number.isInteger(normalized) || normalized < 1) return fallback
  return normalized
}

async function resolveProductForCartInput({ productId, productQuery } = {}) {
  if (typeof productId === 'string' && /^[0-9a-f\d]{24}$/i.test(productId.trim())) {
    const product = await productRepository.findById(productId.trim(), { lean: true })
    if (product) return product
  }

  if (typeof productQuery === 'string' && productQuery.trim()) {
    return findProductByQuery(productQuery.trim())
  }

  return null
}

function findCartItemIndex(items = [], { productId, productQuery, product } = {}) {
  if (!Array.isArray(items) || items.length === 0) return -1

  const resolvedProductId = product?._id ? product._id.toString() : null
  if (resolvedProductId) {
    const byResolvedProduct = items.findIndex(item => item.productId.toString() === resolvedProductId)
    if (byResolvedProduct >= 0) return byResolvedProduct
  }

  if (typeof productId === 'string' && productId.trim()) {
    const normalizedId = productId.trim()
    const byId = items.findIndex(item => item.productId.toString() === normalizedId)
    if (byId >= 0) return byId
  }

  if (typeof productQuery === 'string' && productQuery.trim()) {
    const normalizedQuery = productQuery.trim().toLowerCase()
    return items.findIndex(item =>
      String(item.slug || '').toLowerCase() === normalizedQuery
      || String(item.name || '').toLowerCase() === normalizedQuery
    )
  }

  return -1
}

function getStoredCartUnitPrice(item = {}) {
  if (item.isFlashSale && item.salePrice != null) return Number(item.salePrice)
  return Number(item.price || 0)
}

function calculateEffectiveProductPrice(product = {}) {
  return Math.round(Number(product.price || 0) * (1 - Number(product.discountPercentage || 0) / 100))
}

function parseToolPayload(payload) {
  if (payload == null) return null
  if (typeof payload !== 'string') return payload

  try {
    return JSON.parse(payload)
  } catch {
    return { raw: payload }
  }
}

function normalizeSubtotal(subtotal) {
  const value = Number(subtotal)
  return Number.isFinite(value) && value > 0 ? value : null
}

function isPromoExpired(promo, now = new Date()) {
  return !!(promo?.expiresAt && new Date(promo.expiresAt) < now)
}

function isPromoExhausted(promo) {
  return promo?.usageLimit != null && Number(promo.usedCount || 0) >= Number(promo.usageLimit)
}

function hasUserUsedPromo(promo, userId) {
  if (!promo || !userId || !Array.isArray(promo.usedBy)) return false
  return promo.usedBy.some(item => String(item) === String(userId))
}

function calculatePromoDiscount(promo, subtotal) {
  if (!promo || !Number.isFinite(Number(subtotal))) return 0

  if (promo.discountType === 'percent') {
    let discount = Math.floor((Number(subtotal) * Number(promo.discountValue || 0)) / 100)
    if (promo.maxDiscount) {
      discount = Math.min(discount, Number(promo.maxDiscount))
    }
    return discount
  }

  return Number(promo.discountValue || 0)
}

function buildPromoPayload(promo, { subtotal = null } = {}) {
  const payload = {
    code: promo.code,
    discountType: promo.discountType,
    discountValue: promo.discountValue,
    description: promo.discountType === 'percent'
      ? `Giảm ${promo.discountValue}%${promo.maxDiscount ? `, tối đa ${formatPrice(promo.maxDiscount)}` : ''}`
      : `Giảm ${formatPrice(promo.discountValue)}`,
    minOrder: promo.minOrder || 0,
    minOrderFormatted: formatPrice(promo.minOrder || 0),
    maxDiscount: promo.maxDiscount || null,
    maxDiscountFormatted: promo.maxDiscount ? formatPrice(promo.maxDiscount) : null,
    usageRemaining: promo.usageLimit != null
      ? Math.max(0, Number(promo.usageLimit) - Number(promo.usedCount || 0))
      : null,
    expiresAt: promo.expiresAt || null,
    expiresAtFormatted: promo.expiresAt ? formatDate(promo.expiresAt) : null,
    isPrivate: !!promo.userId
  }

  if (subtotal !== null) {
    payload.eligible = subtotal >= Number(promo.minOrder || 0)
    payload.estimatedDiscount = payload.eligible ? calculatePromoDiscount(promo, subtotal) : 0
    payload.estimatedDiscountFormatted = formatPrice(payload.estimatedDiscount)
  }

  return payload
}

function excerptText(text, maxLength = 180) {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim()
  if (!normalized) return ''
  if (normalized.length <= maxLength) return normalized
  return `${normalized.slice(0, maxLength - 1).trim()}…`
}

function formatDate(value) {
  if (!value) return null
  return new Date(value).toLocaleDateString('vi-VN')
}

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
  getAvailablePromoCodes,
  checkPromoCode,
  getCart,
  addToCart,
  updateCartQuantity,
  removeFromCart,
  validateCart,
  clearCart,
  browseByCategory,
  getPopularProducts,
  getProductReviewSummary
}

/**
 * Thực thi một tool call từ AI response
 * @param {string} toolName - Tên hàm
 * @param {Object} args - Tham số (đã parse từ JSON)
 * @returns {string} Kết quả dạng JSON string
 */
async function executeTool(toolName, args, context = {}) {
  const executor = toolExecutors[toolName]
  const toolMeta = getToolByName(toolName)
  if (!executor) {
    logger.warn(`[AI Tool] Unknown tool: ${toolName}`)
    return JSON.stringify({ error: `Không tìm thấy công cụ "${toolName}".` })
  }

  if (toolMeta?.requiresConfirmation && args?.confirmed !== true) {
    return JSON.stringify({
      success: false,
      confirmationRequired: true,
      message: toolMeta.confirmationMessage
        || `Cong cu ${toolMeta.label || toolName} can xac nhan ro rang truoc khi thuc hien.`
    })
  }

  logger.info(`[AI Tool] Executing: ${toolName}(${JSON.stringify(args)})`)
  const startTime = Date.now()
  const result = await executor(args || {}, context)
  const elapsed = Date.now() - startTime
  logger.info(`[AI Tool] ${toolName} completed in ${elapsed}ms`)

  return result
}

module.exports = {
  TOOL_REGISTRY,
  getToolByName,
  getToolDefinitions,
  getToolRegistry,
  executeTool
}
