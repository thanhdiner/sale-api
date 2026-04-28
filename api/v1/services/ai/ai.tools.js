/**
 * AI Tools — Function Calling definitions & executors
 * Cho phép AI chatbot truy vấn Database để trả lời khách hàng
 *
 * Hỗ trợ: searchProduct, getProductDetail, checkOrderStatus, getFlashSales
 */

const productRepository = require('../../repositories/product.repository')
const productCategoryRepository = require('../../repositories/productCategory.repository')
const productViewRepository = require('../../repositories/productView.repository')
const orderRepository = require('../../repositories/order.repository')
const cartRepository = require('../../repositories/cart.repository')
const wishlistRepository = require('../../repositories/wishlist.repository')
const promoCodeRepository = require('../../repositories/promoCode.repository')
const reviewRepository = require('../../repositories/review.repository')
const userRepository = require('../../repositories/user.repository')
const blogPostRepository = require('../../repositories/blogPost.repository')
const websiteConfigRepository = require('../../repositories/websiteConfig.repository')
const agentToolCallRepository = require('../../repositories/agentToolCall.repository')
const { findAllDescendantIds } = require('../../helpers/product-categoryHelper')
const ordersService = require('../client/orders.service')
const paymentService = require('../client/payment.service')
const bankInfoService = require('../client/bankInfo.service')
const clientUserService = require('../client/user.service')
const clientProductService = require('../client/products.service')
const clientReviewsService = require('../client/reviews.service')
const faqPageService = require('../faqPage.service')
const returnPolicyPageService = require('../returnPolicyPage.service')
const privacyPolicyPageService = require('../privacyPolicyPage.service')
const termsContentService = require('../client/termsContent.service')
const vipContentService = require('../client/vipContent.service')
const { normalizeStructuredAddress } = require('../../utils/structuredAddress')
const applyTranslation = require('../../utils/applyTranslation')
const logger = require('../../../../config/logger')
const removeAccents = require('remove-accents')

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000'
const MAX_CART_UNIQUE_ITEMS = 50
const DEFAULT_WISHLIST_LIMIT = 12
const MAX_WISHLIST_LIMIT = 50
const DEFAULT_SEARCH_PRODUCTS_LIMIT = 5
const MAX_SEARCH_PRODUCTS_LIMIT = 10
const MIN_COMPARE_PRODUCTS = 2
const MAX_COMPARE_PRODUCTS = 4
const MAX_AVAILABILITY_PRODUCTS = 10
const POLICY_SOURCES = ['faq', 'returnPolicy', 'privacyPolicy', 'terms']
const DEFAULT_POLICY_SEARCH_LIMIT = 6
const MAX_POLICY_SEARCH_LIMIT = 12
const BLOG_TRANSLATION_FIELDS = ['title', 'excerpt', 'content', 'category', 'tags']
const DEFAULT_BLOG_POST_LIMIT = 5
const MAX_BLOG_POST_LIMIT = 10
const DEFAULT_BUYING_GUIDE_LIMIT = 8
const MAX_BUYING_GUIDE_LIMIT = 16
const DEFAULT_COUPON_WALLET_EXPIRING_SOON_DAYS = 7
const MAX_COUPON_WALLET_EXPIRING_SOON_DAYS = 30
const DEFAULT_COUPON_WALLET_LIMIT = 8
const MAX_COUPON_WALLET_LIMIT = 12
const COUPON_WALLET_PROMO_LOOKUP_LIMIT = 150
const PLACE_ORDER_PAYMENT_METHODS = ['vnpay', 'momo', 'zalopay', 'sepay']
const PLACE_ORDER_DELIVERY_METHODS = ['pickup', 'contact']
const CHECKOUT_PROFILE_DELIVERY_METHODS = ['pickup', 'contact']
const CHECKOUT_PROFILE_PAYMENT_METHODS = ['transfer', 'contact', 'vnpay', 'momo', 'zalopay', 'sepay']
const FREE_SHIPPING_THRESHOLD = 100000
const DEFAULT_SHIPPING_FEE = 50000
const CHECKOUT_PROFILE_STRING_FIELDS = ['firstName', 'lastName', 'phone', 'email', 'notes']
const CHECKOUT_PROFILE_ADDRESS_FIELDS = [
  'addressLine1',
  'provinceCode',
  'provinceName',
  'districtCode',
  'districtName',
  'wardCode',
  'wardName',
  'address'
]
const CHECKOUT_PROFILE_MUTATION_FIELDS = [
  ...CHECKOUT_PROFILE_STRING_FIELDS,
  ...CHECKOUT_PROFILE_ADDRESS_FIELDS,
  'deliveryMethod',
  'paymentMethod'
]
const LOYALTY_VND_PER_POINT = 1000
const LOYALTY_TIERS = [
  { key: 'member', labelVi: 'Thanh vien', labelEn: 'Member', minPoints: 0 },
  { key: 'silver', labelVi: 'Silver', labelEn: 'Silver', minPoints: 1000 },
  { key: 'gold', labelVi: 'Gold', labelEn: 'Gold', minPoints: 3000 },
  { key: 'diamond', labelVi: 'Diamond', labelEn: 'Diamond', minPoints: 8000 }
]
const USER_PROFILE_MUTATION_FIELDS = ['fullName', 'phone', 'avatarUrl']
const NOTIFICATION_CHANNEL_FIELDS = ['inApp', 'email', 'browser', 'sms']
const NOTIFICATION_TOPIC_FIELDS = [
  'orderUpdates',
  'paymentUpdates',
  'promotions',
  'backInStock',
  'wishlistUpdates',
  'supportMessages'
]
const ORDER_ADDRESS_FIELDS = [...CHECKOUT_PROFILE_ADDRESS_FIELDS, 'notes']
const ORDER_ADDRESS_LOCATION_FIELDS = [
  'provinceCode',
  'provinceName',
  'districtCode',
  'districtName',
  'wardCode',
  'wardName'
]
const POLICY_SOURCE_META = {
  faq: {
    label: 'FAQ',
    url: `${CLIENT_URL}/faq`
  },
  returnPolicy: {
    label: 'Chinh sach doi tra',
    url: `${CLIENT_URL}/return-policy`
  },
  privacyPolicy: {
    label: 'Chinh sach bao mat',
    url: `${CLIENT_URL}/privacy-policy`
  },
  terms: {
    label: 'Dieu khoan su dung',
    url: `${CLIENT_URL}/terms-of-service`
  }
}

// ─── Tool Registry (hard-code trong backend, admin chỉ bật/tắt quyền dùng) ───

const TOOL_REGISTRY = [
  {
    name: 'searchProducts',
    label: 'Tìm sản phẩm',
    description: 'Tim kiem va loc san pham tren SmartMall. Ho tro keyword, category, khoang gia sau giam, rating toi thieu, ton kho, sort va limit.',
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
          description: 'Tu khoa tim kiem san pham. Co the bo trong neu chi dung filter.'
        },
        category: {
          type: 'string',
          description: 'Danh muc san pham theo id, slug hoac ten danh muc. Tu dong gom danh muc con.'
        },
        minPrice: {
          type: 'number',
          description: 'Gia sau giam toi thieu.'
        },
        maxPrice: {
          type: 'number',
          description: 'Gia sau giam toi da.'
        },
        minRating: {
          type: 'number',
          description: 'Diem danh gia toi thieu, tu 0 den 5.'
        },
        rating: {
          type: 'number',
          description: 'Alias cua minRating.'
        },
        inStock: {
          type: 'boolean',
          description: 'true de chi lay san pham con hang, false de chi lay san pham het hang.'
        },
        sort: {
          type: 'string',
          enum: [
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
          ],
          description: 'Thu tu sap xep ket qua.'
        },
        limit: {
          type: 'number',
          description: 'So san pham muon lay, mac dinh 5 va toi da 10.'
        }
      },
      required: []
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
    name: 'checkProductAvailability',
    label: 'Kiem tra ton kho',
    description: 'Kiem tra ton kho nhanh cho 1 hoac nhieu san pham. Dung productId/productQuery cho mot san pham, hoac productIds/productQueries/products de kiem tra nhieu san pham; co the truyen quantity de biet co du hang hay khong.',
    group: 'catalog',
    riskLevel: 'safe',
    requiresConfirmation: false,
    defaultEnabled: true,
    endpoint: 'productService.checkProductAvailability',
    parameters: {
      type: 'object',
      properties: {
        productId: {
          type: 'string',
          description: 'MongoDB ObjectId cua san pham can kiem tra.'
        },
        productQuery: {
          type: 'string',
          description: 'Ten hoac slug san pham can kiem tra neu chua co productId.'
        },
        quantity: {
          type: 'number',
          description: 'So luong khach muon mua de kiem tra du ton kho, mac dinh 1.'
        },
        productIds: {
          type: 'array',
          description: 'Danh sach MongoDB ObjectId cua san pham can kiem tra, toi da 10.',
          items: { type: 'string' },
          maxItems: 10
        },
        productQueries: {
          type: 'array',
          description: 'Danh sach ten hoac slug san pham can kiem tra, toi da 10.',
          items: { type: 'string' },
          maxItems: 10
        },
        products: {
          type: 'array',
          description: 'Danh sach san pham can kiem tra. Moi item co the co productId, productQuery va quantity rieng.',
          items: {
            type: 'object',
            properties: {
              productId: { type: 'string' },
              productQuery: { type: 'string' },
              quantity: { type: 'number' }
            }
          },
          maxItems: 10
        }
      },
      required: []
    }
  },
  {
    name: 'compareProducts',
    label: 'So sánh sản phẩm',
    description: 'So sánh 2-4 sản phẩm khi khách hỏi nên mua A hay B. Dùng productIds nếu đã có ID, hoặc productQueries là tên/slug sản phẩm. Trả về giá, tồn kho, rating, sold, discount, features và gợi ý lựa chọn theo từng tiêu chí.',
    group: 'catalog',
    riskLevel: 'safe',
    requiresConfirmation: false,
    defaultEnabled: true,
    endpoint: 'productService.compareProducts',
    parameters: {
      type: 'object',
      properties: {
        productIds: {
          type: 'array',
          description: 'Danh sách MongoDB ObjectId của sản phẩm cần so sánh, tối đa 4 sản phẩm',
          items: { type: 'string' },
          minItems: 2,
          maxItems: 4
        },
        productQueries: {
          type: 'array',
          description: 'Danh sách tên hoặc slug sản phẩm cần so sánh, tối đa 4 sản phẩm',
          items: { type: 'string' },
          minItems: 2,
          maxItems: 4
        },
        products: {
          type: 'array',
          description: 'Danh sách sản phẩm cần so sánh. Mỗi item có thể là chuỗi tên/slug hoặc object có productId/productQuery.',
          items: {
            type: 'object',
            properties: {
              productId: { type: 'string' },
              productQuery: { type: 'string' }
            }
          },
          minItems: 2,
          maxItems: 4
        }
      },
      required: []
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
    name: 'listMyOrders',
    label: 'Danh sach don cua toi',
    description: 'Lay danh sach don hang gan day cua khach dang dang nhap. Dung khi khach hoi don hang cua toi, lich su mua hang, don gan nhat, hoac muon xem cac don co the theo doi/huy.',
    group: 'orders',
    riskLevel: 'safe',
    requiresConfirmation: false,
    defaultEnabled: true,
    endpoint: 'orderService.listMyOrders',
    parameters: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['pending', 'confirmed', 'shipping', 'completed', 'cancelled'],
          description: 'Trang thai don hang muon loc. Bo trong de lay tat ca.'
        },
        limit: {
          type: 'number',
          description: 'So don hang muon lay, mac dinh 5 va toi da 10.'
        }
      },
      required: []
    }
  },
  {
    name: 'getOrderDetail',
    label: 'Chi tiet don hang',
    description: 'Lay chi tiet mot don hang cua khach dang dang nhap theo orderId hoac ma don/orderCode. Chi tra du lieu da loc an toan cho chat.',
    group: 'orders',
    riskLevel: 'safe',
    requiresConfirmation: false,
    defaultEnabled: true,
    endpoint: 'orderService.getOrderDetail',
    parameters: {
      type: 'object',
      properties: {
        orderId: {
          type: 'string',
          description: 'MongoDB ObjectId cua don hang, neu co.'
        },
        orderCode: {
          type: 'string',
          description: 'Ma don hang/orderCode hoac ma hien thi khach cung cap.'
        }
      },
      required: []
    }
  },
  {
    name: 'getOrderInvoice',
    label: 'Hoa don/bien nhan don hang',
    description: 'Lay link hoa don, bien nhan hoac huong dan lay bien nhan cua mot don hang. Neu he thong chua co file hoa don rieng, tra ve link chi tiet don hang va huong dan in/luu PDF tu trang don hang.',
    group: 'orders',
    riskLevel: 'safe',
    requiresConfirmation: false,
    defaultEnabled: true,
    endpoint: 'orderService.getOrderInvoice',
    parameters: {
      type: 'object',
      properties: {
        orderId: {
          type: 'string',
          description: 'MongoDB ObjectId cua don hang, neu co.'
        },
        orderCode: {
          type: 'string',
          description: 'Ma don hang/orderCode hoac ma hien thi khach cung cap.'
        }
      },
      required: []
    }
  },
  {
    name: 'reorderPreviousOrder',
    label: 'Dat lai don cu',
    description: 'Tao don thanh toan moi tu cac san pham trong mot don cu cua khach dang dang nhap. Tool nay tao don moi va tru/giu ton kho nen chi goi sau khi khach xac nhan ro rang.',
    group: 'orders',
    riskLevel: 'dangerous',
    requiresConfirmation: true,
    confirmationMessage: 'Hanh dong nay se tao mot don hang moi tu cac san pham trong don cu, dung gia va ton kho hien tai. Ban co chac muon dat lai don nay khong?',
    defaultEnabled: true,
    endpoint: 'orderService.reorderPreviousOrder',
    parameters: {
      type: 'object',
      properties: {
        orderId: {
          type: 'string',
          description: 'MongoDB ObjectId cua don hang cu, neu co.'
        },
        orderCode: {
          type: 'string',
          description: 'Ma don hang/orderCode hoac ma hien thi cua don cu.'
        },
        paymentMethod: {
          type: 'string',
          enum: ['vnpay', 'momo', 'zalopay', 'sepay', 'card'],
          description: 'Cong thanh toan online cho don moi. Neu bo trong thi dung cong thanh toan online cua don cu, hoac mac dinh VNPay.'
        },
        deliveryMethod: {
          type: 'string',
          enum: ['pickup', 'contact'],
          description: 'Cach nhan hang cho don moi. Neu bo trong thi dung cach nhan hang cua don cu.'
        },
        promoCode: {
          type: 'string',
          description: 'Ma giam gia muon ap cho don moi. Khong tu dung lai ma cua don cu neu khach khong yeu cau.'
        },
        shipping: {
          type: 'number',
          description: 'Phi giao/ban giao neu khach da xac nhan. Bo trong de he thong tinh mac dinh.'
        },
        confirmed: {
          type: 'boolean',
          description: 'Phai la true sau khi khach da xac nhan ro rang muon dat lai don cu.'
        }
      },
      required: ['confirmed']
    }
  },
  {
    name: 'trackOrderByCode',
    label: 'Theo doi don bang ma',
    description: 'Tra cuu/tracking don hang bang ma don hang va so dien thoai dat hang. Dung cho khach chua dang nhap hoac khi khach chi cung cap ma don + phone.',
    group: 'orders',
    riskLevel: 'safe',
    requiresConfirmation: false,
    defaultEnabled: true,
    endpoint: 'orderService.trackOrder',
    parameters: {
      type: 'object',
      properties: {
        orderCode: {
          type: 'string',
          description: 'Ma don hang/orderCode khach cung cap.'
        },
        phone: {
          type: 'string',
          description: 'So dien thoai da dung khi dat hang.'
        }
      },
      required: ['orderCode', 'phone']
    }
  },
  {
    name: 'cancelOrder',
    label: 'Huy don hang',
    description: 'Huy mot don hang pending cua khach dang dang nhap theo orderId hoac orderCode. Day la hanh dong nguy hiem, chi goi sau khi khach xac nhan ro rang.',
    group: 'orders',
    riskLevel: 'dangerous',
    requiresConfirmation: true,
    confirmationMessage: 'Hanh dong nay se huy don hang dang cho xu ly cua ban va hoan lai ton kho neu co. Ban co chac muon huy don nay khong?',
    defaultEnabled: true,
    endpoint: 'orderService.cancelOrder',
    parameters: {
      type: 'object',
      properties: {
        orderId: {
          type: 'string',
          description: 'MongoDB ObjectId cua don hang can huy, neu co.'
        },
        orderCode: {
          type: 'string',
          description: 'Ma don hang/orderCode hoac ma hien thi khach cung cap.'
        },
        confirmed: {
          type: 'boolean',
          description: 'Phai la true sau khi khach da xac nhan ro rang muon huy don hang.'
        }
      },
      required: ['confirmed']
    }
  },
  {
    name: 'updateOrderAddress',
    label: 'Sua dia chi don hang',
    description: 'Sua dia chi giao hang cho don hang pending cua khach dang dang nhap theo orderId hoac orderCode. Day la tool ghi du lieu; chi goi sau khi khach xac nhan ro rang dia chi moi va lan goi thuc thi phai truyen confirmed=true.',
    group: 'orders',
    riskLevel: 'write',
    requiresConfirmation: true,
    confirmationMessage: 'Hanh dong nay se cap nhat dia chi giao hang cua don dang cho xu ly. Ban co chac muon luu dia chi moi cho don nay khong?',
    defaultEnabled: true,
    endpoint: 'orderService.updateOrderAddress',
    parameters: {
      type: 'object',
      properties: {
        orderId: {
          type: 'string',
          description: 'MongoDB ObjectId cua don pending can sua dia chi, neu co.'
        },
        orderCode: {
          type: 'string',
          description: 'Ma don hang/orderCode hoac ma hien thi khach cung cap.'
        },
        confirmed: {
          type: 'boolean',
          description: 'Phai la true sau khi khach da xac nhan ro rang muon cap nhat dia chi giao hang.'
        },
        address: {
          type: 'string',
          description: 'Dia chi giao hang day du dang tu do neu khong co du lieu tinh/huyen/xa co cau truc.'
        },
        addressLine1: {
          type: 'string',
          description: 'So nha, ten duong hoac dia chi chi tiet.'
        },
        provinceCode: {
          type: 'string',
          description: 'Ma tinh/thanh moi, neu co.'
        },
        provinceName: {
          type: 'string',
          description: 'Ten tinh/thanh moi, neu co.'
        },
        districtCode: {
          type: 'string',
          description: 'Ma quan/huyen moi, neu co.'
        },
        districtName: {
          type: 'string',
          description: 'Ten quan/huyen moi, neu co.'
        },
        wardCode: {
          type: 'string',
          description: 'Ma phuong/xa moi, neu co.'
        },
        wardName: {
          type: 'string',
          description: 'Ten phuong/xa moi, neu co.'
        },
        notes: {
          type: 'string',
          description: 'Ghi chu giao hang moi, neu khach muon cap nhat kem dia chi.'
        }
      },
      required: ['confirmed']
    }
  },
  {
    name: 'updateOrderContact',
    label: 'Cap nhat lien he don hang',
    description: 'Sua so dien thoai, email hoac ghi chu cua mot don pending cua khach dang dang nhap. Day la hanh dong ghi du lieu va can khach xac nhan ro rang truoc khi thuc thi.',
    group: 'orders',
    riskLevel: 'write',
    requiresConfirmation: true,
    confirmationMessage: 'Hanh dong nay se cap nhat so dien thoai, email hoac ghi chu tren don hang dang cho xac nhan. Ban co chac muon luu thay doi nay khong?',
    defaultEnabled: true,
    endpoint: 'orderService.updateOrderContact',
    parameters: {
      type: 'object',
      properties: {
        orderId: {
          type: 'string',
          description: 'MongoDB ObjectId cua don hang can sua, neu co.'
        },
        orderCode: {
          type: 'string',
          description: 'Ma don hang/orderCode hoac ma hien thi khach cung cap.'
        },
        phone: {
          type: 'string',
          description: 'So dien thoai moi cua don hang. Neu khong doi thi bo trong.'
        },
        email: {
          type: 'string',
          description: 'Email moi cua don hang. Co the truyen chuoi rong de xoa email.'
        },
        notes: {
          type: 'string',
          description: 'Ghi chu moi cua don hang. Co the truyen chuoi rong de xoa ghi chu.'
        },
        confirmed: {
          type: 'boolean',
          description: 'Phai la true sau khi khach da xac nhan ro rang muon cap nhat thong tin lien he don hang.'
        }
      },
      required: ['confirmed']
    }
  },
  {
    name: 'updatePendingOrderItems',
    label: 'Sua san pham don pending',
    description: 'Sua danh sach san pham hoac so luong trong don hang pending chua thanh toan cua khach dang dang nhap. Tool nay se cap nhat tong tien va tra ve link/thong tin thanh toan moi, can khach xac nhan ro rang truoc khi thuc thi.',
    group: 'orders',
    riskLevel: 'write',
    requiresConfirmation: true,
    confirmationMessage: 'Hanh dong nay se cap nhat san pham/so luong va tong tien cua don hang dang cho thanh toan. Ban co chac muon luu thay doi nay khong?',
    defaultEnabled: true,
    endpoint: 'orderService.updatePendingOrderItems',
    parameters: {
      type: 'object',
      properties: {
        orderId: {
          type: 'string',
          description: 'MongoDB ObjectId cua don pending can sua, neu co.'
        },
        orderCode: {
          type: 'string',
          description: 'Ma don hang/orderCode hoac ma hien thi khach cung cap.'
        },
        mode: {
          type: 'string',
          enum: ['replace', 'update', 'add', 'remove'],
          description: 'replace=thay toan bo danh sach bang items; update=sua so luong item; add=them vao don; remove=xoa khoi don. Mac dinh replace khi co items.'
        },
        items: {
          type: 'array',
          description: 'Danh sach san pham theo mode. Voi replace day la danh sach san pham cuoi cung cua don sau khi sua.',
          items: {
            type: 'object',
            properties: {
              productId: { type: 'string' },
              productQuery: { type: 'string' },
              name: { type: 'string' },
              slug: { type: 'string' },
              quantity: { type: 'number' }
            }
          }
        },
        updates: {
          type: 'array',
          description: 'Danh sach san pham can set lai so luong. quantity=0 se xoa san pham khoi don.',
          items: {
            type: 'object',
            properties: {
              productId: { type: 'string' },
              productQuery: { type: 'string' },
              name: { type: 'string' },
              slug: { type: 'string' },
              quantity: { type: 'number' }
            }
          }
        },
        addItems: {
          type: 'array',
          description: 'Danh sach san pham can them vao don; neu da co san pham thi cong them so luong.',
          items: {
            type: 'object',
            properties: {
              productId: { type: 'string' },
              productQuery: { type: 'string' },
              name: { type: 'string' },
              slug: { type: 'string' },
              quantity: { type: 'number' }
            }
          }
        },
        removeItems: {
          type: 'array',
          description: 'Danh sach san pham can xoa khoi don.',
          items: {
            type: 'object',
            properties: {
              productId: { type: 'string' },
              productQuery: { type: 'string' },
              name: { type: 'string' },
              slug: { type: 'string' }
            }
          }
        },
        productId: {
          type: 'string',
          description: 'San pham can sua nhanh neu chi thao tac mot item.'
        },
        productQuery: {
          type: 'string',
          description: 'Ten/slug san pham can sua nhanh neu chua co productId.'
        },
        quantity: {
          type: 'number',
          description: 'So luong moi cho thao tac update nhanh; quantity=0 de xoa item.'
        },
        confirmed: {
          type: 'boolean',
          description: 'Phai la true sau khi khach da xac nhan ro rang muon cap nhat san pham/so luong trong don pending.'
        }
      },
      required: ['confirmed']
    }
  },
  {
    name: 'checkPaymentStatus',
    label: 'Kiem tra trang thai thanh toan',
    description: 'Kiem tra trang thai thanh toan cua don hang theo orderId/orderCode. Ho tro pending/paid/failed/expired cho VNPay, MoMo, ZaloPay va Sepay. Khach chua dang nhap can cung cap them so dien thoai dat hang.',
    group: 'payments',
    riskLevel: 'safe',
    requiresConfirmation: false,
    defaultEnabled: true,
    endpoint: 'paymentService.checkPaymentStatus',
    parameters: {
      type: 'object',
      properties: {
        orderId: {
          type: 'string',
          description: 'MongoDB ObjectId cua don hang, neu co.'
        },
        orderCode: {
          type: 'string',
          description: 'Ma don hang/orderCode hoac ma hien thi khach cung cap.'
        },
        phone: {
          type: 'string',
          description: 'So dien thoai dat hang. Bat buoc khi khach chua dang nhap.'
        }
      },
      required: []
    }
  },
  {
    name: 'resumePayment',
    label: 'Lay lai link thanh toan',
    description: 'Tao lai link thanh toan cho don pending cua khach dang dang nhap. Ho tro VNPay, MoMo, ZaloPay va huong dan Sepay cho don chua thanh toan.',
    group: 'payments',
    riskLevel: 'safe',
    requiresConfirmation: false,
    defaultEnabled: true,
    endpoint: 'paymentService.resumePayment',
    parameters: {
      type: 'object',
      properties: {
        orderId: {
          type: 'string',
          description: 'MongoDB ObjectId cua don pending, neu khach cung cap.'
        },
        orderCode: {
          type: 'string',
          description: 'Ma don hang/orderCode hoac ma hien thi khach cung cap.'
        },
        paymentMethod: {
          type: 'string',
          enum: ['vnpay', 'momo', 'zalopay', 'sepay', 'card'],
          description: 'Cong thanh toan khach muon lay lai. Neu bo trong thi dung paymentMethod cua don. Phai khop voi don pending.'
        }
      },
      required: []
    }
  },
  {
    name: 'getBankInfo',
    label: 'Thong tin chuyen khoan',
    description: 'Lay thong tin tai khoan ngan hang active va QR chuyen khoan. Neu co don pending/Sepay, tra them so tien va noi dung chuyen khoan can dung.',
    group: 'payments',
    riskLevel: 'safe',
    requiresConfirmation: false,
    defaultEnabled: true,
    endpoint: 'bankInfoService.getActiveBankInfo',
    parameters: {
      type: 'object',
      properties: {
        orderId: {
          type: 'string',
          description: 'MongoDB ObjectId cua don pending de lay so tien va ma noi dung chuyen khoan.'
        },
        orderCode: {
          type: 'string',
          description: 'Ma don hang/orderCode de lay noi dung chuyen khoan.'
        },
        paymentReference: {
          type: 'string',
          description: 'Ma noi dung chuyen khoan neu da co tu resumePayment/placeOrder.'
        },
        amount: {
          type: 'number',
          description: 'So tien can chuyen neu khong truyen orderId/orderCode.'
        }
      },
      required: []
    }
  },
  {
    name: 'verifyBankTransfer',
    label: 'Kiem tra chuyen khoan',
    description: 'Tra trang thai ghi nhan chuyen khoan/Sepay theo orderCode hoac paymentReference. Dung khi khach hoi da chuyen khoan chua, he thong da nhan tien chua, hoac can kiem tra trang thai thanh toan ngan hang.',
    group: 'payments',
    riskLevel: 'safe',
    requiresConfirmation: false,
    defaultEnabled: true,
    endpoint: 'paymentService.verifyBankTransfer',
    parameters: {
      type: 'object',
      properties: {
        orderCode: {
          type: 'string',
          description: 'Ma don hang/orderCode khach cung cap, co the co hoac khong co dau #.'
        },
        paymentReference: {
          type: 'string',
          description: 'Noi dung chuyen khoan/paymentReference khach da nhap khi chuyen tien.'
        }
      },
      required: []
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
    name: 'getCouponWallet',
    label: 'Vi ma giam gia',
    description: 'Xem vi ma giam gia cua khach dang chat: ma rieng cua khach, ma da luu trong gio hang, va cac ma sap het han. Dung khi khach hoi toi co ma nao, ma rieng, ma da luu, voucher sap het han.',
    group: 'promotions',
    riskLevel: 'safe',
    requiresConfirmation: false,
    defaultEnabled: true,
    endpoint: 'promoCodeService.getCouponWallet',
    parameters: {
      type: 'object',
      properties: {
        subtotal: {
          type: 'number',
          description: 'Gia tri don tam tinh de uoc tinh muc giam va danh dau ma du dieu kien'
        },
        expiringSoonDays: {
          type: 'number',
          description: 'So ngay toi da de xem la sap het han, mac dinh 7 ngay'
        },
        limit: {
          type: 'number',
          description: 'So ma toi da moi nhom nen tra ve'
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
    name: 'getVipBenefits',
    label: 'Quyen loi VIP',
    description: 'Lay noi dung chuong trinh VIP Membership/SmartMall Plus: quyen loi, goi thanh vien, bang so sanh va FAQ. Dung khi khach hoi ve VIP, uu dai thanh vien, gia goi VIP, tich diem, freeship hoac ho tro uu tien.',
    group: 'membership',
    riskLevel: 'safe',
    requiresConfirmation: false,
    defaultEnabled: true,
    endpoint: 'vipContentService.getVipContent',
    parameters: {
      type: 'object',
      properties: {
        language: {
          type: 'string',
          enum: ['vi', 'en'],
          description: 'Ngon ngu noi dung can lay, mac dinh vi'
        },
        includePlans: {
          type: 'boolean',
          description: 'Co tra ve cac goi VIP va gia hien thi hay khong, mac dinh true'
        },
        includeFaqs: {
          type: 'boolean',
          description: 'Co tra ve FAQ VIP hay khong, mac dinh true'
        }
      },
      required: []
    }
  },
  {
    name: 'getLoyaltyStatus',
    label: 'Trang thai thanh vien',
    description: 'Xem diem tich luy, hang thanh vien hien tai va tien do len hang cua khach dang dang nhap. Dung khi khach hoi minh co bao nhieu diem, dang hang nao, can bao nhieu diem de len Silver/Gold/Diamond.',
    group: 'membership',
    riskLevel: 'safe',
    requiresConfirmation: false,
    defaultEnabled: true,
    endpoint: 'loyaltyService.getStatus',
    parameters: {
      type: 'object',
      properties: {
        language: {
          type: 'string',
          enum: ['vi', 'en'],
          description: 'Ngon ngu nhan hang trong ket qua, mac dinh vi'
        },
        includeRecentOrders: {
          type: 'boolean',
          description: 'Co tra ve mot vai don hoan thanh gan day dung de tinh diem hay khong, mac dinh false'
        }
      },
      required: []
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
    description: 'Thêm sản phẩm vào giỏ hàng của khách đang chat. Chỉ dùng khi khách muốn thêm/giữ trong giỏ, không dùng thay cho lệnh mua giúp/đặt hàng. Với yêu cầu mua trực tiếp, dùng placeOrder.',
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
    name: 'applyPromoCodeToCart',
    label: 'Ap ma giam gia vao gio',
    description: 'Ap va luu ma giam gia hop le vao gio hang hien tai cua khach dang chat. Dung khi khach muon ap/dung ma cho gio hang, khong chi kiem tra ma. Khong danh dau ma da su dung cho den khi dat hang thanh cong.',
    group: 'cart',
    riskLevel: 'write',
    requiresConfirmation: false,
    defaultEnabled: true,
    endpoint: 'cartService.applyPromoCodeToCart',
    parameters: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          description: 'Ma giam gia can ap vao gio hang'
        }
      },
      required: ['code']
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
    name: 'removePromoCodeFromCart',
    label: 'Go ma giam gia khoi gio',
    description: 'Go ma giam gia dang xet cho gio hang va tra lai gio hang khong kem kiem tra ma giam gia.',
    group: 'cart',
    riskLevel: 'write',
    requiresConfirmation: false,
    defaultEnabled: true,
    endpoint: 'cartService.removePromoCodeFromCart',
    parameters: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          description: 'Ma giam gia can go neu khach co nhac ro'
        }
      },
      required: []
    }
  },
  {
    name: 'getCheckoutProfile',
    label: 'Ho so dat hang mac dinh',
    description: 'Lay thong tin dat hang mac dinh cua khach dang chat. Dung khi khach muon xem, kiem tra hoac chuan bi sua thong tin lien he, dia chi, cach nhan hang, phuong thuc thanh toan mac dinh.',
    group: 'checkout',
    riskLevel: 'safe',
    requiresConfirmation: false,
    defaultEnabled: true,
    endpoint: 'userService.getCheckoutProfile',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'getUserProfile',
    label: 'Ho so khach hang',
    description: 'Doc thong tin ho so co ban cua khach dang dang nhap, gom username, ho ten, email, so dien thoai, avatar, trang thai va lan dang nhap gan nhat.',
    group: 'account',
    riskLevel: 'safe',
    requiresConfirmation: false,
    defaultEnabled: true,
    endpoint: 'userService.getUserProfile',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'requestPasswordReset',
    label: 'Yeu cau dat lai mat khau',
    description: 'Khoi tao luong quen mat khau an toan bang email. Tool chi gui ma/huong dan reset qua email neu email hop le; khong duoc nhan, doi, tiet lo hoac xac minh mat khau trong chat. Can khach xac nhan email va truyen confirmed=true.',
    group: 'account',
    riskLevel: 'write',
    requiresConfirmation: true,
    confirmationMessage: 'Hanh dong nay se gui ma xac thuc dat lai mat khau den email ban cung cap neu email co tai khoan. Ban co chac muon tiep tuc khong?',
    defaultEnabled: true,
    endpoint: 'userService.requestPasswordReset',
    parameters: {
      type: 'object',
      properties: {
        confirmed: {
          type: 'boolean',
          description: 'Phai la true sau khi khach xac nhan muon nhan email/mã xac thuc dat lai mat khau.'
        },
        email: {
          type: 'string',
          description: 'Email tai khoan can khoi tao dat lai mat khau. Khong truyen mat khau, ma OTP hoac password moi.'
        }
      },
      required: ['confirmed', 'email']
    }
  },
  {
    name: 'getNotificationPreferences',
    label: 'Tuy chon thong bao',
    description: 'Doc tuy chon thong bao cua khach dang dang nhap, gom kenh nhan thong bao va cac nhom thong bao order, thanh toan, khuyen mai, hang ve lai, wishlist va ho tro.',
    group: 'account',
    riskLevel: 'safe',
    requiresConfirmation: false,
    defaultEnabled: true,
    endpoint: 'userService.getNotificationPreferences',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'updateUserProfile',
    label: 'Cap nhat ho so khach hang',
    description: 'Cap nhat ho so co ban cua khach dang dang nhap, gom ho ten, so dien thoai hoac avatar. Day la tool ghi du lieu; chi goi sau khi khach xac nhan ro rang cac thong tin can sua va lan goi thuc thi phai truyen confirmed=true. Khong dung de doi email.',
    group: 'account',
    riskLevel: 'write',
    requiresConfirmation: true,
    confirmationMessage: 'Hanh dong nay se cap nhat ho so co ban trong tai khoan cua ban. Ban co chac muon luu cac thay doi nay khong?',
    defaultEnabled: true,
    endpoint: 'userService.updateUserProfile',
    parameters: {
      type: 'object',
      properties: {
        confirmed: {
          type: 'boolean',
          description: 'Phai la true sau khi khach da xac nhan ro rang muon cap nhat ho so co ban.'
        },
        fullName: {
          type: 'string',
          description: 'Ho ten moi cua khach. Khong duoc de trong neu truyen field nay.'
        },
        phone: {
          type: 'string',
          description: 'So dien thoai moi cua khach, gom 9-15 chu so. Truyen chuoi rong neu khach muon xoa so dien thoai.'
        },
        avatarUrl: {
          type: 'string',
          description: 'URL avatar moi. Truyen chuoi rong neu khach muon xoa avatar.'
        }
      },
      required: ['confirmed']
    }
  },
  {
    name: 'requestEmailChange',
    label: 'Gui OTP doi email',
    description: 'Gui ma OTP xac thuc den email moi cua khach dang dang nhap. Dung khi khach muon doi email tai khoan. Tool nay chi khoi tao OTP, khong cap nhat email; sau do phai dung verifyEmailChange voi email va code khach cung cap.',
    group: 'account',
    riskLevel: 'write',
    requiresConfirmation: false,
    defaultEnabled: true,
    endpoint: 'userService.requestEmailChange',
    parameters: {
      type: 'object',
      properties: {
        email: {
          type: 'string',
          description: 'Email moi ma khach muon doi sang.'
        },
        newEmail: {
          type: 'string',
          description: 'Alias cua email.'
        }
      },
      required: []
    }
  },
  {
    name: 'verifyEmailChange',
    label: 'Xac minh doi email',
    description: 'Xac minh OTP da gui den email moi va cap nhat email tai khoan cua khach dang dang nhap. Dung sau requestEmailChange khi khach cung cap ma OTP.',
    group: 'account',
    riskLevel: 'write',
    requiresConfirmation: false,
    defaultEnabled: true,
    endpoint: 'userService.verifyEmailChange',
    parameters: {
      type: 'object',
      properties: {
        email: {
          type: 'string',
          description: 'Email moi da nhan OTP.'
        },
        newEmail: {
          type: 'string',
          description: 'Alias cua email.'
        },
        code: {
          type: 'string',
          description: 'Ma OTP 6 chu so khach nhan duoc qua email.'
        },
        otp: {
          type: 'string',
          description: 'Alias cua code.'
        }
      },
      required: []
    }
  },
  {
    name: 'requestAccountDeletion',
    label: 'Yeu cau xoa tai khoan',
    description: 'Tao ticket yeu cau xoa tai khoan cho khach dang dang nhap. Tool nay khong xoa tai khoan ngay trong chat; chi ghi nhan yeu cau de nhan vien xac minh va xu ly theo quy trinh. Can khach xac nhan ro rang va truyen confirmed=true.',
    group: 'account',
    riskLevel: 'dangerous',
    requiresConfirmation: true,
    confirmationMessage: 'Yeu cau nay se ghi nhan mong muon xoa tai khoan va chuyen cho nhan vien xac minh. Tai khoan co the mat quyen truy cap va du lieu ca nhan se duoc xu ly theo quy trinh sau khi duoc duyet. Ban co chac muon gui yeu cau xoa tai khoan khong?',
    defaultEnabled: true,
    endpoint: 'userService.requestAccountDeletion',
    parameters: {
      type: 'object',
      properties: {
        confirmed: {
          type: 'boolean',
          description: 'Phai la true sau khi khach da xac nhan ro rang muon gui yeu cau xoa tai khoan.'
        },
        reason: {
          type: 'string',
          description: 'Ly do khach muon xoa tai khoan neu co.'
        },
        details: {
          type: 'string',
          description: 'Ghi chu bo sung cho nhan vien ho tro neu co.'
        },
        preferredContactMethod: {
          type: 'string',
          enum: ['email', 'phone', 'chat'],
          description: 'Kenh lien he/xac minh uu tien, mac dinh email neu tai khoan co email.'
        },
        phone: {
          type: 'string',
          description: 'So dien thoai lien he bo sung neu khach muon nhan vien xac minh qua dien thoai.'
        }
      },
      required: ['confirmed']
    }
  },
  {
    name: 'getDeliveryOptions',
    label: 'Phuong thuc nhan hang',
    description: 'Lay cac phuong thuc nhan hang/giao hang kha dung, ETA va uoc tinh phi theo san pham, gio hang hoac tam tinh don hang. Tool chi doc du lieu, khong tao don.',
    group: 'checkout',
    riskLevel: 'safe',
    requiresConfirmation: false,
    defaultEnabled: true,
    endpoint: 'orderService.getDeliveryOptions',
    parameters: {
      type: 'object',
      properties: {
        productId: {
          type: 'string',
          description: 'MongoDB ObjectId cua san pham can xem ETA/nhan hang.'
        },
        productQuery: {
          type: 'string',
          description: 'Ten hoac slug san pham can xem ETA/nhan hang neu chua co productId.'
        },
        quantity: {
          type: 'number',
          description: 'So luong san pham neu xem cho mot san pham cu the. Mac dinh 1.'
        },
        items: {
          type: 'array',
          description: 'Danh sach san pham can xem phuong thuc nhan/giao va ETA.',
          items: {
            type: 'object',
            properties: {
              productId: { type: 'string' },
              productQuery: { type: 'string' },
              quantity: { type: 'number' }
            }
          }
        },
        subtotal: {
          type: 'number',
          description: 'Tam tinh don hang neu da biet, dung de uoc tinh phi giao/ban giao.'
        },
        promoCode: {
          type: 'string',
          description: 'Ma giam gia neu muon kiem tra gio hang hien tai cung luc.'
        },
        useCart: {
          type: 'boolean',
          description: 'Neu true hoac bo trong, khach da dang nhap va khong truyen san pham cu the thi dung gio hang hien tai de tinh ETA/phi.'
        }
      },
      required: []
    }
  },
  {
    name: 'updateCheckoutProfile',
    label: 'Cap nhat ho so dat hang',
    description: 'Luu hoac sua thong tin dat hang mac dinh cua khach dang chat. Day la tool ghi du lieu; chi goi sau khi khach xac nhan ro rang cac thong tin can luu/sua va lan goi thuc thi phai truyen confirmed=true.',
    group: 'checkout',
    riskLevel: 'write',
    requiresConfirmation: true,
    confirmationMessage: 'Hanh dong nay se cap nhat thong tin dat hang mac dinh trong tai khoan cua ban. Ban co chac muon luu cac thay doi nay khong?',
    defaultEnabled: true,
    endpoint: 'userService.updateCheckoutProfile',
    parameters: {
      type: 'object',
      properties: {
        confirmed: {
          type: 'boolean',
          description: 'Phai la true sau khi khach da xac nhan ro rang muon luu/sua thong tin dat hang mac dinh.'
        },
        firstName: {
          type: 'string',
          description: 'Ho/ten dem mac dinh khi dat hang'
        },
        lastName: {
          type: 'string',
          description: 'Ten mac dinh khi dat hang'
        },
        phone: {
          type: 'string',
          description: 'So dien thoai nhan hang, gom 9-15 chu so'
        },
        email: {
          type: 'string',
          description: 'Email lien he khi dat hang'
        },
        addressLine1: {
          type: 'string',
          description: 'Dia chi chi tiet, so nha/duong'
        },
        provinceCode: {
          type: 'string',
          description: 'Ma tinh/thanh'
        },
        provinceName: {
          type: 'string',
          description: 'Ten tinh/thanh'
        },
        districtCode: {
          type: 'string',
          description: 'Ma quan/huyen'
        },
        districtName: {
          type: 'string',
          description: 'Ten quan/huyen'
        },
        wardCode: {
          type: 'string',
          description: 'Ma phuong/xa'
        },
        wardName: {
          type: 'string',
          description: 'Ten phuong/xa'
        },
        address: {
          type: 'string',
          description: 'Dia chi day du dang tu do neu khong co du lieu tinh/huyen/xa co cau truc'
        },
        notes: {
          type: 'string',
          description: 'Ghi chu dat hang mac dinh'
        },
        deliveryMethod: {
          type: 'string',
          enum: ['pickup', 'contact'],
          description: 'Cach nhan hang mac dinh'
        },
        paymentMethod: {
          type: 'string',
          enum: ['transfer', 'contact', 'vnpay', 'momo', 'zalopay', 'sepay'],
          description: 'Phuong thuc thanh toan mac dinh'
        }
      },
      required: ['confirmed']
    }
  },
  {
    name: 'updateNotificationPreferences',
    label: 'Cap nhat tuy chon thong bao',
    description: 'Cap nhat tuy chon thong bao cua khach dang dang nhap. Day la tool ghi du lieu; chi goi sau khi khach xac nhan ro rang cac thay doi va lan goi thuc thi phai truyen confirmed=true.',
    group: 'account',
    riskLevel: 'write',
    requiresConfirmation: true,
    confirmationMessage: 'Hanh dong nay se cap nhat tuy chon thong bao trong tai khoan cua ban. Ban co chac muon luu cac thay doi nay khong?',
    defaultEnabled: true,
    endpoint: 'userService.updateNotificationPreferences',
    parameters: {
      type: 'object',
      properties: {
        confirmed: {
          type: 'boolean',
          description: 'Phai la true sau khi khach da xac nhan ro rang muon luu tuy chon thong bao.'
        },
        channels: {
          type: 'object',
          description: 'Tuy chon kenh nhan thong bao.',
          properties: {
            inApp: { type: 'boolean', description: 'Nhan thong bao trong ung dung.' },
            email: { type: 'boolean', description: 'Nhan thong bao qua email.' },
            browser: { type: 'boolean', description: 'Nhan thong bao trinh duyet.' },
            sms: { type: 'boolean', description: 'Nhan thong bao SMS neu he thong ho tro.' }
          }
        },
        inApp: {
          type: 'boolean',
          description: 'Alias cua channels.inApp.'
        },
        email: {
          type: 'boolean',
          description: 'Alias cua channels.email.'
        },
        browser: {
          type: 'boolean',
          description: 'Alias cua channels.browser.'
        },
        sms: {
          type: 'boolean',
          description: 'Alias cua channels.sms.'
        },
        orderUpdates: {
          type: 'boolean',
          description: 'Nhan thong bao cap nhat trang thai don hang.'
        },
        paymentUpdates: {
          type: 'boolean',
          description: 'Nhan thong bao thanh toan/chuyen khoan.'
        },
        promotions: {
          type: 'boolean',
          description: 'Nhan thong bao khuyen mai/ma giam gia.'
        },
        backInStock: {
          type: 'boolean',
          description: 'Nhan thong bao khi san pham dang quan tam co hang lai.'
        },
        wishlistUpdates: {
          type: 'boolean',
          description: 'Nhan thong bao lien quan den san pham trong wishlist.'
        },
        supportMessages: {
          type: 'boolean',
          description: 'Nhan thong bao phan hoi ho tro/chat.'
        }
      },
      required: ['confirmed']
    }
  },
  {
    name: 'placeOrder',
    label: 'Đặt hàng',
    description: 'Tạo đơn hàng từ giỏ hàng hiện tại cho khách đang chat. Chỉ dùng sau khi đã xác nhận giỏ hàng, thông tin liên hệ, phương thức nhận hàng và thanh toán. Chỉ hỗ trợ thanh toán transfer hoặc contact trong chat.',
    group: 'orders',
    riskLevel: 'dangerous',
    requiresConfirmation: true,
    confirmationMessage: 'Hành động này sẽ tạo đơn hàng từ giỏ hàng hiện tại và trừ tồn kho. Bạn có chắc muốn đặt hàng không?',
    defaultEnabled: true,
    endpoint: 'orderService.placeOrder',
    parameters: {
      type: 'object',
      properties: {
        confirmed: {
          type: 'boolean',
          description: 'Phải là true sau khi khách đã xác nhận rõ ràng muốn đặt hàng.'
        },
        contact: {
          type: 'object',
          description: 'Thông tin liên hệ/nhận hàng nếu khách muốn ghi đè hồ sơ checkout đã lưu.',
          properties: {
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            phone: { type: 'string' },
            email: { type: 'string' },
            addressLine1: { type: 'string' },
            provinceCode: { type: 'string' },
            provinceName: { type: 'string' },
            districtCode: { type: 'string' },
            districtName: { type: 'string' },
            wardCode: { type: 'string' },
            wardName: { type: 'string' },
            address: { type: 'string' },
            notes: { type: 'string' }
          }
        },
        productId: {
          type: 'string',
          description: 'MongoDB ObjectId của sản phẩm muốn đặt ngay. Dùng khi khách yêu cầu mua một sản phẩm cụ thể thay vì toàn bộ giỏ.'
        },
        productQuery: {
          type: 'string',
          description: 'Tên hoặc slug sản phẩm muốn đặt ngay nếu chưa có productId.'
        },
        quantity: {
          type: 'number',
          description: 'Số lượng sản phẩm muốn đặt ngay khi dùng productId/productQuery. Mặc định 1.'
        },
        items: {
          type: 'array',
          description: 'Danh sách sản phẩm muốn đặt ngay. Nếu có items/productId/productQuery thì tool chỉ tạo đơn cho các sản phẩm này, không đặt toàn bộ giỏ.',
          items: {
            type: 'object',
            properties: {
              productId: { type: 'string' },
              productQuery: { type: 'string' },
              quantity: { type: 'number' }
            }
          }
        },
        deliveryMethod: {
          type: 'string',
          enum: ['pickup', 'contact'],
          description: 'Cách nhận hàng. Mặc định lấy từ hồ sơ checkout, nếu không có thì pickup.'
        },
        paymentMethod: {
          type: 'string',
          enum: ['vnpay', 'momo', 'zalopay', 'sepay', 'card'],
          description: 'Phương thức thanh toán online. Dùng vnpay cho thanh toán thẻ/ATM/QR; card sẽ được hiểu là vnpay. Sepay dùng chuyển khoản tự động qua webhook. Không hỗ trợ transfer/contact.'
        },
        promoCode: {
          type: 'string',
          description: 'Mã giảm giá muốn áp dụng cho đơn hàng.'
        },
        shipping: {
          type: 'number',
          description: 'Phí giao/bàn giao nếu khách đã xác nhận. Bỏ trống để hệ thống tính mặc định.'
        }
      },
      required: ['confirmed']
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
    name: 'getWishlist',
    label: 'Xem danh sách yêu thích',
    description: 'Lấy danh sách sản phẩm yêu thích hiện tại của khách đang chat, gồm tên, giá, tồn kho, link và phân trang.',
    group: 'wishlist',
    riskLevel: 'safe',
    requiresConfirmation: false,
    defaultEnabled: true,
    endpoint: 'wishlistService.getWishlist',
    parameters: {
      type: 'object',
      properties: {
        page: {
          type: 'number',
          description: 'Trang wishlist muốn lấy, mặc định 1'
        },
        limit: {
          type: 'number',
          description: 'Số sản phẩm mỗi trang, mặc định 12 và tối đa 50'
        }
      },
      required: []
    }
  },
  {
    name: 'addToWishlist',
    label: 'Thêm yêu thích',
    description: 'Thêm một sản phẩm vào danh sách yêu thích của khách đang chat. Dùng khi khách muốn lưu lại/xem sau/yêu thích sản phẩm.',
    group: 'wishlist',
    riskLevel: 'write',
    requiresConfirmation: false,
    defaultEnabled: true,
    endpoint: 'wishlistService.addWishlistItem',
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
        }
      },
      required: []
    }
  },
  {
    name: 'removeFromWishlist',
    label: 'Xóa khỏi yêu thích',
    description: 'Xóa một sản phẩm khỏi danh sách yêu thích của khách đang chat.',
    group: 'wishlist',
    riskLevel: 'write',
    requiresConfirmation: false,
    defaultEnabled: true,
    endpoint: 'wishlistService.removeWishlistItem',
    parameters: {
      type: 'object',
      properties: {
        productId: {
          type: 'string',
          description: 'MongoDB ObjectId của sản phẩm trong wishlist'
        },
        productQuery: {
          type: 'string',
          description: 'Tên hoặc slug sản phẩm trong wishlist nếu chưa có productId'
        }
      },
      required: []
    }
  },
  {
    name: 'toggleWishlist',
    label: 'Bật/tắt yêu thích',
    description: 'Bật hoặc tắt trạng thái yêu thích của một sản phẩm cho khách đang chat. Nếu đã có trong wishlist thì xóa, nếu chưa có thì thêm.',
    group: 'wishlist',
    riskLevel: 'write',
    requiresConfirmation: false,
    defaultEnabled: true,
    endpoint: 'wishlistService.toggleWishlistItem',
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
        }
      },
      required: []
    }
  },
  {
    name: 'clearWishlist',
    label: 'Xóa toàn bộ yêu thích',
    description: 'Xóa toàn bộ danh sách yêu thích của khách đang chat. Chỉ thực thi sau khi khách xác nhận rõ ràng bằng confirmed=true.',
    group: 'wishlist',
    riskLevel: 'dangerous',
    requiresConfirmation: true,
    confirmationMessage: 'Hành động này sẽ xóa toàn bộ danh sách yêu thích hiện tại. Bạn có chắc muốn tiếp tục không?',
    defaultEnabled: true,
    endpoint: 'wishlistService.clearWishlist',
    parameters: {
      type: 'object',
      properties: {
        confirmed: {
          type: 'boolean',
          description: 'Phải là true sau khi khách đã xác nhận rõ ràng muốn xóa toàn bộ wishlist'
        }
      },
      required: ['confirmed']
    }
  },
  {
    name: 'searchPolicies',
    label: 'Tìm chính sách/FAQ',
    description: 'Tìm trong nội dung FAQ, chính sách đổi trả, chính sách bảo mật và điều khoản đang được admin quản lý. Dùng khi khách hỏi về quy định, đổi trả, hoàn tiền, bảo mật, tài khoản hoặc điều khoản sử dụng.',
    group: 'policies',
    riskLevel: 'safe',
    requiresConfirmation: false,
    defaultEnabled: true,
    endpoint: 'policyService.searchPolicies',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Câu hỏi hoặc từ khóa chính sách cần tìm'
        },
        sources: {
          type: 'array',
          description: 'Nguồn muốn tìm. Bỏ trống để tìm tất cả.',
          items: {
            type: 'string',
            enum: ['faq', 'returnPolicy', 'privacyPolicy', 'terms']
          }
        },
        language: {
          type: 'string',
          enum: ['vi', 'en'],
          description: 'Ngôn ngữ nội dung cần lấy, mặc định vi'
        },
        limit: {
          type: 'number',
          description: 'Số kết quả tối đa, mặc định 6 và tối đa 12'
        }
      },
      required: ['query']
    }
  },
  {
    name: 'getReturnPolicy',
    label: 'Chính sách đổi trả',
    description: 'Lấy nội dung chính sách đổi trả/hoàn tiền đang được admin quản lý. Có thể lọc theo chủ đề khách hỏi.',
    group: 'policies',
    riskLevel: 'safe',
    requiresConfirmation: false,
    defaultEnabled: true,
    endpoint: 'policyService.getReturnPolicy',
    parameters: {
      type: 'object',
      properties: {
        topic: {
          type: 'string',
          description: 'Chủ đề muốn xem trong chính sách đổi trả, ví dụ: hoàn tiền, điều kiện đổi trả, sản phẩm số, thời gian xử lý'
        },
        language: {
          type: 'string',
          enum: ['vi', 'en'],
          description: 'Ngôn ngữ nội dung cần lấy, mặc định vi'
        },
        limit: {
          type: 'number',
          description: 'Số mục liên quan tối đa, mặc định 6 và tối đa 12'
        }
      },
      required: []
    }
  },
  {
    name: 'getPrivacyPolicy',
    label: 'Chinh sach bao mat',
    description: 'Lay noi dung chinh sach bao mat/quyen rieng tu va xu ly du lieu ca nhan dang duoc admin quan ly. Dung khi khach hoi ve bao mat tai khoan, thu thap du lieu, chia se du lieu, cookie hoac quyen rieng tu.',
    group: 'policies',
    riskLevel: 'safe',
    requiresConfirmation: false,
    defaultEnabled: true,
    endpoint: 'policyService.getPrivacyPolicy',
    parameters: {
      type: 'object',
      properties: {
        topic: {
          type: 'string',
          description: 'Chu de muon xem trong chinh sach bao mat, vi du: du lieu ca nhan, cookie, chia se du lieu, bao mat tai khoan, quyen nguoi dung'
        },
        language: {
          type: 'string',
          enum: ['vi', 'en'],
          description: 'Ngon ngu noi dung can lay, mac dinh vi'
        },
        limit: {
          type: 'number',
          description: 'So muc lien quan toi da, mac dinh 6 va toi da 12'
        }
      },
      required: []
    }
  },
  {
    name: 'getTermsOfService',
    label: 'Dieu khoan su dung',
    description: 'Lay noi dung dieu khoan su dung/dieu kien dich vu dang duoc admin quan ly. Dung khi khach hoi ve quy dinh su dung website, tai khoan, trach nhiem, han che, tranh chap hoac dieu khoan mua hang.',
    group: 'policies',
    riskLevel: 'safe',
    requiresConfirmation: false,
    defaultEnabled: true,
    endpoint: 'policyService.getTermsOfService',
    parameters: {
      type: 'object',
      properties: {
        topic: {
          type: 'string',
          description: 'Chu de muon xem trong dieu khoan su dung, vi du: tai khoan, thanh toan, han che trach nhiem, quyen so huu tri tue, cham dut dich vu'
        },
        language: {
          type: 'string',
          enum: ['vi', 'en'],
          description: 'Ngon ngu noi dung can lay, mac dinh vi'
        },
        limit: {
          type: 'number',
          description: 'So muc lien quan toi da, mac dinh 6 va toi da 12'
        }
      },
      required: []
    }
  },
  {
    name: 'getFAQ',
    label: 'FAQ',
    description: 'Lấy câu hỏi thường gặp đang được admin quản lý. Có thể tìm theo câu hỏi của khách.',
    group: 'policies',
    riskLevel: 'safe',
    requiresConfirmation: false,
    defaultEnabled: true,
    endpoint: 'policyService.getFAQ',
    parameters: {
      type: 'object',
      properties: {
        question: {
          type: 'string',
          description: 'Câu hỏi hoặc từ khóa FAQ khách đang hỏi'
        },
        language: {
          type: 'string',
          enum: ['vi', 'en'],
          description: 'Ngôn ngữ nội dung cần lấy, mặc định vi'
        },
        limit: {
          type: 'number',
          description: 'Số FAQ tối đa, mặc định 6 và tối đa 12'
        }
      },
      required: []
    }
  },
  {
    name: 'searchBlogPosts',
    label: 'Bai viet blog',
    description: 'Tim bai viet blog da publish theo tu khoa, danh muc hoac tag. Dung khi khach muon doc bai tu van, tin tuc, meo chon san pham hoac can nguon noi dung co san de tham khao.',
    group: 'content',
    riskLevel: 'safe',
    requiresConfirmation: false,
    defaultEnabled: true,
    endpoint: 'blogService.searchBlogPosts',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Tu khoa hoac chu de bai viet can tim.'
        },
        category: {
          type: 'string',
          description: 'Danh muc blog can loc, neu co.'
        },
        tag: {
          type: 'string',
          description: 'Tag blog can loc, neu co.'
        },
        language: {
          type: 'string',
          enum: ['vi', 'en'],
          description: 'Ngon ngu noi dung can lay, mac dinh vi.'
        },
        sort: {
          type: 'string',
          enum: ['relevance', 'featured', 'newest', 'oldest'],
          description: 'Thu tu ket qua, mac dinh relevance khi co query, newest khi khong co query.'
        },
        limit: {
          type: 'number',
          description: 'So bai viet toi da, mac dinh 5 va toi da 10.'
        }
      },
      required: []
    }
  },
  {
    name: 'getBuyingGuides',
    label: 'Huong dan mua hang',
    description: 'Lay noi dung trang huong dan mua hang dang co trong website config. Dung khi khach can huong dan quy trinh mua, thanh toan, theo doi don, FAQ mua hang hoac meo mua sam.',
    group: 'content',
    riskLevel: 'safe',
    requiresConfirmation: false,
    defaultEnabled: true,
    endpoint: 'websiteConfigService.getBuyingGuides',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Tu khoa hoac chu de huong dan can tim.'
        },
        topic: {
          type: 'string',
          description: 'Alias cua query, dung khi model goi theo chu de.'
        },
        section: {
          type: 'string',
          enum: ['overview', 'steps', 'detailedSteps', 'payment', 'faq', 'tips', 'support'],
          description: 'Phan huong dan muon loc. Bo trong de tim tat ca.'
        },
        language: {
          type: 'string',
          enum: ['vi', 'en'],
          description: 'Ngon ngu noi dung can lay, mac dinh vi.'
        },
        limit: {
          type: 'number',
          description: 'So muc huong dan toi da, mac dinh 8 va toi da 16.'
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
    name: 'getPersonalizedRecommendations',
    label: 'Goi y ca nhan hoa',
    description: 'Lay danh sach san pham goi y tu /products/recommendations. Dung khi khach muon tu van san pham phu hop; uu tien tool nay hon getPopularProducts neu khach khong hoi rieng ve best seller.',
    group: 'catalog',
    riskLevel: 'safe',
    requiresConfirmation: false,
    defaultEnabled: true,
    endpoint: 'productService.getPersonalizedRecommendations',
    parameters: {
      type: 'object',
      properties: {
        tab: {
          type: 'string',
          enum: ['for-you', 'cheap-deals', 'newest'],
          description: 'Nhom goi y can lay. for-you phu hop nhat voi tu van ca nhan, cheap-deals cho san pham gia tot, newest cho san pham moi.'
        },
        limit: {
          type: 'number',
          description: 'So luong san pham muon lay, mac dinh 5 va toi da 10.'
        },
        page: {
          type: 'number',
          description: 'Trang ket qua, mac dinh 1.'
        }
      },
      required: []
    }
  },
  {
    name: 'getRecentViewedProducts',
    label: 'San pham vua xem',
    description: 'Lay danh sach san pham khach vua xem de tu van theo ngu canh hien tai. Uu tien khi khach hoi "san pham vua xem", "cai vua roi", "tu van theo mon minh dang xem" hoac can goi y dua tren lich su xem gan day.',
    group: 'catalog',
    riskLevel: 'safe',
    requiresConfirmation: false,
    defaultEnabled: true,
    endpoint: 'productService.getRecentViewedProducts',
    parameters: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'So san pham vua xem muon lay, mac dinh 5 va toi da 10.'
        },
        includeCurrentPage: {
          type: 'boolean',
          description: 'Neu true, them san pham tren trang hien tai lam fallback khi chua co lich su view.'
        },
        includeRelated: {
          type: 'boolean',
          description: 'Neu true, lay them san pham lien quan theo san pham vua xem gan nhat de ho tro tu van.'
        },
        relatedLimit: {
          type: 'number',
          description: 'So san pham lien quan muon lay, mac dinh 4 va toi da 8.'
        }
      },
      required: []
    }
  },
  {
    name: 'getRelatedProducts',
    label: 'San pham lien quan',
    description: 'Lay danh sach san pham lien quan tu explore-more dua tren mot san pham cu the. Dung khi khach dang xem/hoi ve mot san pham va muon goi y lua chon tuong tu.',
    group: 'catalog',
    riskLevel: 'safe',
    requiresConfirmation: false,
    defaultEnabled: true,
    endpoint: 'productService.getRelatedProducts',
    parameters: {
      type: 'object',
      properties: {
        productId: {
          type: 'string',
          description: 'MongoDB ObjectId cua san pham lam moc de goi y san pham lien quan.'
        },
        productQuery: {
          type: 'string',
          description: 'Ten hoac slug san pham neu chua co productId.'
        },
        limit: {
          type: 'number',
          description: 'So luong san pham lien quan muon lay, mac dinh 5 va toi da 10.'
        }
      },
      required: []
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
  },
  {
    name: 'getProductReviews',
    label: 'Danh sach review san pham',
    description: 'Lay danh sach review cong khai that cua mot san pham theo productId hoac ten/slug. Ho tro loc rating, sort, page va limit; dung khi khach muon xem nhan xet cu the thay vi chi xem tom tat.',
    group: 'reviews',
    riskLevel: 'safe',
    requiresConfirmation: false,
    defaultEnabled: true,
    endpoint: 'reviewService.getProductReviews',
    parameters: {
      type: 'object',
      properties: {
        productId: {
          type: 'string',
          description: 'MongoDB ObjectId cua san pham neu da co tu tool khac.'
        },
        productQuery: {
          type: 'string',
          description: 'Ten hoac slug san pham can xem review neu chua co productId.'
        },
        rating: {
          type: 'number',
          enum: [1, 2, 3, 4, 5],
          description: 'Loc review theo so sao tu 1 den 5. Bo trong de lay tat ca rating.'
        },
        sort: {
          type: 'string',
          enum: ['newest', 'helpful', 'highRating', 'lowRating'],
          description: 'Thu tu review: newest, helpful, highRating hoac lowRating.'
        },
        page: {
          type: 'number',
          description: 'Trang review muon lay, mac dinh 1.'
        },
        limit: {
          type: 'number',
          description: 'So review moi trang, mac dinh 5 va toi da 10.'
        }
      },
      required: []
    }
  },
  {
    name: 'createReview',
    label: 'Tao danh gia san pham',
    description: 'Tao review text cho san pham da mua cua khach dang dang nhap. Day la tool ghi du lieu: chi goi sau khi khach xac nhan ro rang noi dung/rating va lan goi thuc thi phai truyen confirmed=true.',
    group: 'reviews',
    riskLevel: 'write',
    requiresConfirmation: true,
    confirmationMessage: 'Hanh dong nay se dang danh gia cong khai cho san pham bang tai khoan cua ban. Ban co chac muon gui danh gia nay khong?',
    defaultEnabled: true,
    endpoint: 'reviewService.createReview',
    parameters: {
      type: 'object',
      properties: {
        confirmed: {
          type: 'boolean',
          description: 'Phai la true sau khi khach da xac nhan ro rang muon dang danh gia.'
        },
        productId: {
          type: 'string',
          description: 'MongoDB ObjectId cua san pham can danh gia neu da co tu tool khac.'
        },
        productQuery: {
          type: 'string',
          description: 'Ten hoac slug san pham can danh gia neu chua co productId.'
        },
        rating: {
          type: 'number',
          enum: [1, 2, 3, 4, 5],
          description: 'So sao danh gia tu 1 den 5.'
        },
        title: {
          type: 'string',
          description: 'Tieu de ngan cua danh gia, toi da 200 ky tu.'
        },
        content: {
          type: 'string',
          description: 'Noi dung danh gia, toi da 2000 ky tu.'
        }
      },
      required: ['confirmed', 'rating']
    }
  },
  {
    name: 'updateReview',
    label: 'Sua danh gia san pham',
    description: 'Sua review cua chinh khach dang dang nhap theo reviewId hoac san pham. Day la tool ghi du lieu: chi goi sau khi khach xac nhan ro rang noi dung/rating moi va lan goi thuc thi phai truyen confirmed=true.',
    group: 'reviews',
    riskLevel: 'write',
    requiresConfirmation: true,
    confirmationMessage: 'Hanh dong nay se cap nhat danh gia cong khai cua ban. Ban co chac muon luu thay doi nay khong?',
    defaultEnabled: true,
    endpoint: 'reviewService.updateReview',
    parameters: {
      type: 'object',
      properties: {
        confirmed: {
          type: 'boolean',
          description: 'Phai la true sau khi khach da xac nhan ro rang muon sua danh gia.'
        },
        reviewId: {
          type: 'string',
          description: 'MongoDB ObjectId cua review can sua, neu da co tu getProductReviews/getProductReviewSummary.'
        },
        productId: {
          type: 'string',
          description: 'MongoDB ObjectId cua san pham co review cua khach.'
        },
        productQuery: {
          type: 'string',
          description: 'Ten hoac slug san pham co review cua khach neu chua co productId/reviewId.'
        },
        rating: {
          type: 'number',
          enum: [1, 2, 3, 4, 5],
          description: 'So sao moi tu 1 den 5. Bo trong de giu rating cu.'
        },
        title: {
          type: 'string',
          description: 'Tieu de moi. Bo trong neu khach muon xoa tieu de; neu khong truyen field nay thi giu tieu de cu.'
        },
        content: {
          type: 'string',
          description: 'Noi dung moi. Bo trong neu khach muon xoa noi dung; neu khong truyen field nay thi giu noi dung cu.'
        },
        keepImages: {
          type: 'array',
          description: 'Danh sach URL anh review muon giu. Neu khong truyen thi giu media hien co.',
          items: { type: 'string' }
        },
        keepVideos: {
          type: 'array',
          description: 'Danh sach URL video review muon giu. Neu khong truyen thi giu media hien co.',
          items: { type: 'string' }
        }
      },
      required: ['confirmed']
    }
  },
  {
    name: 'deleteReview',
    label: 'Xoa danh gia san pham',
    description: 'Xoa review cua chinh khach dang dang nhap theo reviewId hoac san pham. Day la hanh dong xoa du lieu, chi goi sau khi khach xac nhan ro rang va lan goi thuc thi phai truyen confirmed=true.',
    group: 'reviews',
    riskLevel: 'dangerous',
    requiresConfirmation: true,
    confirmationMessage: 'Hanh dong nay se xoa danh gia cua ban va khong the khoi phuc trong chat. Ban co chac muon xoa danh gia nay khong?',
    defaultEnabled: true,
    endpoint: 'reviewService.deleteReview',
    parameters: {
      type: 'object',
      properties: {
        confirmed: {
          type: 'boolean',
          description: 'Phai la true sau khi khach da xac nhan ro rang muon xoa danh gia.'
        },
        reviewId: {
          type: 'string',
          description: 'MongoDB ObjectId cua review can xoa, neu da co tu getProductReviews/getProductReviewSummary.'
        },
        productId: {
          type: 'string',
          description: 'MongoDB ObjectId cua san pham co review cua khach.'
        },
        productQuery: {
          type: 'string',
          description: 'Ten hoac slug san pham co review cua khach neu chua co productId/reviewId.'
        }
      },
      required: ['confirmed']
    }
  },
  {
    name: 'voteReview',
    label: 'Binh chon review huu ich',
    description: 'Bat/tat vote huu ich cho mot review cong khai cua nguoi khac. Day la tool ghi du lieu: can khach dang nhap, xac nhan ro rang va lan goi thuc thi phai truyen confirmed=true.',
    group: 'reviews',
    riskLevel: 'write',
    requiresConfirmation: true,
    confirmationMessage: 'Hanh dong nay se cap nhat binh chon huu ich cua ban cho review nay. Ban co chac muon tiep tuc khong?',
    defaultEnabled: true,
    endpoint: 'reviewService.voteReview',
    parameters: {
      type: 'object',
      properties: {
        confirmed: {
          type: 'boolean',
          description: 'Phai la true sau khi khach da xac nhan ro rang muon cap nhat vote review.'
        },
        reviewId: {
          type: 'string',
          description: 'MongoDB ObjectId cua review can vote, lay tu getProductReviews hoac highlight cua getProductReviewSummary.'
        }
      },
      required: ['confirmed', 'reviewId']
    }
  },
  {
    name: 'submitContactRequest',
    label: 'Tao yeu cau lien he',
    description: 'Tao yeu cau lien he legacy va dong thoi danh dau hoi thoai can nhan vien theo doi. Neu chi can ticket bat dong bo co category/priority va khong handoff realtime, uu tien createSupportTicket.',
    group: 'support',
    riskLevel: 'write',
    requiresConfirmation: false,
    defaultEnabled: true,
    endpoint: 'contactService.submitContactRequest',
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Ten khach hang neu khach cung cap.'
        },
        email: {
          type: 'string',
          description: 'Email de nhan vien lien he lai. Can co email hoac phone.'
        },
        phone: {
          type: 'string',
          description: 'So dien thoai/Zalo de nhan vien lien he lai. Can co email hoac phone.'
        },
        preferredContactMethod: {
          type: 'string',
          enum: ['email', 'phone', 'zalo', 'facebook', 'chat', 'other'],
          description: 'Kenh lien he khach uu tien.'
        },
        subject: {
          type: 'string',
          description: 'Chu de ngan gon cua yeu cau ho tro.'
        },
        message: {
          type: 'string',
          description: 'Noi dung can ho tro, tom tat dung nhu thong tin khach de lai.'
        },
        priority: {
          type: 'string',
          enum: ['low', 'normal', 'high', 'urgent'],
          description: 'Muc do uu tien cua ticket.'
        }
      },
      required: ['message']
    }
  },
  {
    name: 'scheduleCallback',
    label: 'Dat lich goi lai',
    description: 'Dat lich nhan vien goi lai cho khach. Dung khi khach muon duoc goi lai, hen tu van qua dien thoai/Zalo hoac yeu cau nhan vien chu dong lien he theo khung gio. Can co so dien thoai va thoi gian hoac khoang thoi gian mong muon; neu thieu thi hoi them truoc.',
    group: 'support',
    riskLevel: 'write',
    requiresConfirmation: false,
    defaultEnabled: true,
    endpoint: 'contactService.submitContactRequest',
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Ten khach hang neu khach cung cap.'
        },
        phone: {
          type: 'string',
          description: 'So dien thoai/Zalo de nhan vien goi lai. Bat buoc neu khong co san trong ho so.'
        },
        email: {
          type: 'string',
          description: 'Email bo sung de nhan vien lien he neu khong goi duoc.'
        },
        preferredContactMethod: {
          type: 'string',
          enum: ['phone', 'zalo'],
          description: 'Kenh goi/lien he uu tien.'
        },
        callbackAt: {
          type: 'string',
          description: 'Thoi diem goi lai neu xac dinh duoc, uu tien ISO 8601 kem timezone khi co.'
        },
        preferredDate: {
          type: 'string',
          description: 'Ngay khach muon duoc goi lai neu tach rieng voi gio.'
        },
        preferredTime: {
          type: 'string',
          description: 'Gio khach muon duoc goi lai, vi du 14:30.'
        },
        preferredTimeWindow: {
          type: 'string',
          description: 'Khung gio goi lai neu khach dua khoang thoi gian, vi du 9:00-11:00, chieu nay, toi nay, cang som cang tot.'
        },
        timezone: {
          type: 'string',
          description: 'Mui gio cua khach, mac dinh Asia/Ho_Chi_Minh neu khong noi ro.'
        },
        reason: {
          type: 'string',
          description: 'Ly do hoac noi dung khach muon nhan vien tu van khi goi lai.'
        },
        notes: {
          type: 'string',
          description: 'Ghi chu them cho nhan vien truoc khi goi.'
        },
        priority: {
          type: 'string',
          enum: ['low', 'normal', 'high', 'urgent'],
          description: 'Muc do uu tien cua callback.'
        }
      }
    }
  },
  {
    name: 'createSupportTicket',
    label: 'Tao support ticket',
    description: 'Tao ticket ho tro bat dong bo co category va priority cho nhan vien theo doi sau, khac voi handoff realtime. Dung khi khach muon mo ticket, de lai thong tin lien he, hen xu ly sau, khieu nai/bao loi/van de don hang can theo doi nhung khong yeu cau nhan vien chat ngay.',
    group: 'support',
    riskLevel: 'write',
    requiresConfirmation: false,
    defaultEnabled: true,
    endpoint: 'contactService.createSupportTicket',
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Ten khach hang neu khach cung cap.'
        },
        email: {
          type: 'string',
          description: 'Email de nhan vien lien he lai. Can co email hoac phone.'
        },
        phone: {
          type: 'string',
          description: 'So dien thoai/Zalo de nhan vien lien he lai. Can co email hoac phone.'
        },
        preferredContactMethod: {
          type: 'string',
          enum: ['email', 'phone', 'zalo', 'facebook', 'chat', 'other'],
          description: 'Kenh lien he khach uu tien.'
        },
        category: {
          type: 'string',
          enum: ['general', 'order', 'payment', 'product', 'delivery', 'warranty', 'refund', 'complaint', 'account', 'technical', 'other'],
          description: 'Danh muc ticket ho tro.'
        },
        priority: {
          type: 'string',
          enum: ['low', 'normal', 'high', 'urgent'],
          description: 'Muc do uu tien cua ticket.'
        },
        subject: {
          type: 'string',
          description: 'Chu de ngan gon cua ticket.'
        },
        message: {
          type: 'string',
          description: 'Noi dung can ho tro, tom tat dung nhu thong tin khach de lai.'
        }
      },
      required: ['category', 'priority', 'message']
    }
  },
  {
    name: 'requestPersonalDataExport',
    label: 'Yeu cau xuat du lieu ca nhan',
    description: 'Tao ticket yeu cau xuat/tai ve du lieu ca nhan cua khach dang dang nhap. Dung khi khach muon download/export du lieu tai khoan, du lieu ca nhan, lich su don hang, dia chi, wishlist, review hoac chat. Khong tra du lieu ca nhan truc tiep trong chat; chi ghi nhan ticket va gui qua email tai khoan sau khi nhan vien xac minh.',
    group: 'privacy',
    riskLevel: 'write',
    requiresConfirmation: true,
    confirmationMessage: 'Yeu cau nay se tao ticket xuat du lieu ca nhan va nhan vien se gui qua email tai khoan sau khi xac minh. Ban co chac muon tao yeu cau xuat du lieu khong?',
    defaultEnabled: true,
    endpoint: 'privacyService.requestPersonalDataExport',
    parameters: {
      type: 'object',
      properties: {
        confirmed: {
          type: 'boolean',
          description: 'Phai la true sau khi khach xac nhan ro rang muon tao yeu cau xuat du lieu ca nhan.'
        },
        scopes: {
          type: 'array',
          description: 'Pham vi du lieu muon xuat. Mac dinh all.',
          items: {
            type: 'string',
            enum: ['all', 'account', 'orders', 'addresses', 'wishlist', 'reviews', 'chat', 'notifications']
          }
        },
        format: {
          type: 'string',
          enum: ['json', 'csv', 'pdf'],
          description: 'Dinh dang mong muon, mac dinh json.'
        },
        reason: {
          type: 'string',
          description: 'Ly do hoac ghi chu khach cung cap neu co.'
        }
      },
      required: ['confirmed']
    }
  },
  {
    name: 'listMySupportTickets',
    label: 'Danh sach yeu cau ho tro cua toi',
    description: 'Lay cac yeu cau ho tro/ticket gan day da duoc tao qua chatbot cho khach dang dang nhap hoac phien chat hien tai. Dung khi khach hoi ticket cua toi, yeu cau ho tro gan day, lich su callback/bao loi/doi tra da gui.',
    group: 'support',
    riskLevel: 'safe',
    requiresConfirmation: false,
    defaultEnabled: true,
    endpoint: 'supportService.listMySupportTickets',
    parameters: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['all', 'contact_request', 'support_ticket', 'callback', 'bug_report', 'return_refund', 'warranty', 'personal_data_export', 'account_deletion'],
          description: 'Loai yeu cau ho tro muon loc. Mac dinh all.'
        },
        limit: {
          type: 'number',
          description: 'So yeu cau gan day muon lay, mac dinh 5 va toi da 10.'
        }
      },
      required: []
    }
  },
  {
    name: 'reportBugOrIssue',
    label: 'Bao loi/su co',
    description: 'Ghi nhan loi website, thanh toan, san pham, don hang, tai khoan hoac su co ky thuat tu chat thanh ticket ho tro. Dung khi khach bao website bi loi, thanh toan loi, san pham hien thi sai/loi, don hang bat thuong hoac van de can nhan vien theo doi. Tool nay chi ghi nhan su co, khong khang dinh da sua loi.',
    group: 'support',
    riskLevel: 'write',
    requiresConfirmation: true,
    confirmationMessage: 'Hanh dong nay se ghi nhan bao cao loi/su co va chuyen thong tin cho nhan vien ho tro. Ban co chac muon gui bao cao nay khong?',
    defaultEnabled: true,
    endpoint: 'contactService.submitContactRequest',
    parameters: {
      type: 'object',
      properties: {
        confirmed: {
          type: 'boolean',
          description: 'Phai la true sau khi khach da xac nhan ro rang muon gui bao cao loi/su co.'
        },
        issueType: {
          type: 'string',
          enum: ['website', 'payment', 'product', 'order', 'account', 'technical', 'other'],
          description: 'Loai loi/su co can ghi nhan.'
        },
        severity: {
          type: 'string',
          enum: ['low', 'normal', 'high', 'urgent'],
          description: 'Muc do anh huong/uu tien cua su co.'
        },
        title: {
          type: 'string',
          description: 'Tieu de ngan gon cua bao cao loi/su co.'
        },
        description: {
          type: 'string',
          description: 'Mo ta loi/su co khach gap phai, tom tat dung theo thong tin khach cung cap.'
        },
        stepsToReproduce: {
          type: 'string',
          description: 'Cac buoc tai hien loi neu khach cung cap.'
        },
        expectedBehavior: {
          type: 'string',
          description: 'Ket qua mong doi cua khach neu co.'
        },
        actualBehavior: {
          type: 'string',
          description: 'Ket qua thuc te/loi nhin thay neu co.'
        },
        pageUrl: {
          type: 'string',
          description: 'URL trang bi loi neu khach cung cap.'
        },
        currentPage: {
          type: 'string',
          description: 'Trang hien tai trong website neu co.'
        },
        browser: {
          type: 'string',
          description: 'Trinh duyet/phien ban thiet bi neu khach cung cap.'
        },
        device: {
          type: 'string',
          description: 'Thiet bi/he dieu hanh neu khach cung cap.'
        },
        screenshotUrls: {
          type: 'array',
          description: 'Danh sach URL anh chup man hinh neu khach cung cap.',
          items: { type: 'string' }
        },
        orderId: {
          type: 'string',
          description: 'MongoDB ObjectId cua don hang lien quan, neu co.'
        },
        orderCode: {
          type: 'string',
          description: 'Ma don hang lien quan, neu co.'
        },
        paymentReference: {
          type: 'string',
          description: 'Ma tham chieu thanh toan/giao dich lien quan, neu co.'
        },
        productId: {
          type: 'string',
          description: 'MongoDB ObjectId cua san pham lien quan, neu co.'
        },
        productQuery: {
          type: 'string',
          description: 'Ten/tu khoa san pham lien quan, neu co.'
        },
        name: {
          type: 'string',
          description: 'Ten khach hang neu khach cung cap.'
        },
        email: {
          type: 'string',
          description: 'Email de nhan vien lien he lai. Can co email hoac phone.'
        },
        phone: {
          type: 'string',
          description: 'So dien thoai/Zalo de nhan vien lien he lai. Can co email hoac phone.'
        },
        preferredContactMethod: {
          type: 'string',
          enum: ['email', 'phone', 'zalo', 'facebook', 'chat', 'other'],
          description: 'Kenh lien he khach uu tien.'
        }
      },
      required: ['confirmed', 'issueType', 'description']
    }
  },
  {
    name: 'getRefundStatus',
    label: 'Kiem tra trang thai doi tra/hoan tien',
    description: 'Kiem tra trang thai yeu cau doi tra, doi san pham hoac hoan tien da ghi nhan tren don hang. Dung khi khach hoi yeu cau hoan tien/doi tra da toi dau, da duyet chua, dang xu ly hay da hoan tat. Tool nay chi doc trang thai, khong tao ticket moi.',
    group: 'support',
    riskLevel: 'safe',
    requiresConfirmation: false,
    defaultEnabled: true,
    endpoint: 'orderService.getRefundStatus',
    parameters: {
      type: 'object',
      properties: {
        orderId: {
          type: 'string',
          description: 'MongoDB ObjectId cua don hang, neu co.'
        },
        orderCode: {
          type: 'string',
          description: 'Ma don hang/orderCode hoac ma hien thi khach cung cap.'
        },
        phone: {
          type: 'string',
          description: 'So dien thoai dat hang. Can co khi khach chua dang nhap va tra cuu bang orderCode.'
        },
        ticketId: {
          type: 'string',
          description: 'Ma ticket doi tra/hoan tien da nhan neu khach cung cap.'
        }
      },
      required: []
    }
  },
  {
    name: 'getWarrantyStatus',
    label: 'Kiem tra bao hanh',
    description: 'Kiem tra thong tin bao hanh cua san pham trong don hang va trang thai ticket bao hanh neu co. Dung khi khach hoi san pham/don hang con bao hanh khong, thoi han bao hanh, hoac ticket bao hanh dang o trang thai nao. Neu khach chua dang nhap can ma don va so dien thoai dat hang.',
    group: 'support',
    riskLevel: 'safe',
    requiresConfirmation: false,
    defaultEnabled: true,
    endpoint: 'warrantyService.getWarrantyStatus',
    parameters: {
      type: 'object',
      properties: {
        orderId: {
          type: 'string',
          description: 'MongoDB ObjectId cua don hang, neu co.'
        },
        orderCode: {
          type: 'string',
          description: 'Ma don hang/orderCode hoac ma hien thi khach cung cap.'
        },
        phone: {
          type: 'string',
          description: 'So dien thoai dat hang. Can co khi khach chua dang nhap.'
        },
        productId: {
          type: 'string',
          description: 'MongoDB ObjectId cua san pham trong don can kiem tra bao hanh, neu co.'
        },
        productQuery: {
          type: 'string',
          description: 'Ten/tu khoa san pham trong don can kiem tra bao hanh, neu don co nhieu san pham.'
        },
        ticketId: {
          type: 'string',
          description: 'Ma ticket bao hanh da tao, neu khach muon tra cuu theo ticket.'
        }
      },
      required: []
    }
  },
  {
    name: 'requestWarrantySupport',
    label: 'Yeu cau ho tro bao hanh',
    description: 'Tao ticket ho tro bao hanh cho san pham trong don hang. Dung khi khach muon bao hanh, kiem tra loi san pham, can sua/chuyen nha cung cap/doi theo chinh sach bao hanh. Day la tool ghi ticket, khong tu phe duyet bao hanh.',
    group: 'support',
    riskLevel: 'write',
    requiresConfirmation: true,
    confirmationMessage: 'Hanh dong nay se tao yeu cau ho tro bao hanh va chuyen thong tin cho nhan vien kiem tra. Ban co chac muon gui yeu cau nay khong?',
    defaultEnabled: true,
    endpoint: 'warrantyService.requestWarrantySupport',
    parameters: {
      type: 'object',
      properties: {
        confirmed: {
          type: 'boolean',
          description: 'Phai la true sau khi khach da xac nhan ro rang muon gui yeu cau bao hanh.'
        },
        orderId: {
          type: 'string',
          description: 'MongoDB ObjectId cua don hang, neu co.'
        },
        orderCode: {
          type: 'string',
          description: 'Ma don hang/orderCode hoac ma hien thi khach cung cap.'
        },
        phone: {
          type: 'string',
          description: 'So dien thoai dat hang. Can co khi khach chua dang nhap.'
        },
        productId: {
          type: 'string',
          description: 'MongoDB ObjectId cua san pham can bao hanh, neu co.'
        },
        productQuery: {
          type: 'string',
          description: 'Ten/tu khoa san pham can bao hanh, neu don co nhieu san pham.'
        },
        issueDescription: {
          type: 'string',
          description: 'Mo ta loi/tinh trang san pham can bao hanh.'
        },
        requestedResolution: {
          type: 'string',
          enum: ['repair', 'replacement', 'technical_support', 'manufacturer_support', 'other'],
          description: 'Huong ho tro mong muon cua khach.'
        },
        mediaUrls: {
          type: 'array',
          description: 'Danh sach URL anh/video minh chung neu khach cung cap.',
          items: { type: 'string' }
        },
        name: {
          type: 'string',
          description: 'Ten khach hang neu khach cung cap.'
        },
        email: {
          type: 'string',
          description: 'Email de nhan vien lien he lai.'
        },
        preferredContactMethod: {
          type: 'string',
          enum: ['email', 'phone', 'zalo', 'facebook', 'chat', 'other'],
          description: 'Kenh lien he khach uu tien.'
        },
        priority: {
          type: 'string',
          enum: ['low', 'normal', 'high', 'urgent'],
          description: 'Muc do uu tien cua yeu cau bao hanh.'
        }
      },
      required: ['confirmed', 'issueDescription']
    }
  },
  {
    name: 'requestReturnOrRefund',
    label: 'Yeu cau doi tra/hoan tien',
    description: 'Tao yeu cau doi tra, doi san pham hoac hoan tien tu chat cho mot don hang. Dung khi khach muon tra hang, doi hang, bao loi san pham, hoan tien hoac can nhan vien xu ly sau ban hang. Day la ticket ho tro, khong tu phe duyet hoan tien.',
    group: 'support',
    riskLevel: 'write',
    requiresConfirmation: true,
    confirmationMessage: 'Hanh dong nay se tao yeu cau doi tra/hoan tien va chuyen thong tin don hang cho nhan vien ho tro. Ban co chac muon gui yeu cau nay khong?',
    defaultEnabled: true,
    endpoint: 'contactService.submitContactRequest',
    parameters: {
      type: 'object',
      properties: {
        confirmed: {
          type: 'boolean',
          description: 'Phai la true sau khi khach da xac nhan ro rang muon gui yeu cau doi tra/hoan tien.'
        },
        requestType: {
          type: 'string',
          enum: ['return', 'refund', 'exchange', 'return_refund'],
          description: 'Loai yeu cau: return=tra hang, refund=hoan tien, exchange=doi san pham, return_refund=doi tra/hoan tien.'
        },
        orderId: {
          type: 'string',
          description: 'MongoDB ObjectId cua don hang, neu co.'
        },
        orderCode: {
          type: 'string',
          description: 'Ma don hang/orderCode hoac ma hien thi khach cung cap.'
        },
        phone: {
          type: 'string',
          description: 'So dien thoai dat hang. Can co khi khach chua dang nhap va tra cuu bang orderCode.'
        },
        reason: {
          type: 'string',
          description: 'Ly do doi tra/hoan tien khach cung cap.'
        },
        details: {
          type: 'string',
          description: 'Mo ta chi tiet tinh trang, loi gap phai, mong muon xu ly hoac ghi chu them.'
        },
        preferredResolution: {
          type: 'string',
          enum: ['refund', 'exchange', 'store_credit', 'repair', 'support'],
          description: 'Huong xu ly khach mong muon.'
        },
        items: {
          type: 'array',
          description: 'Danh sach san pham trong don ma khach muon doi tra/hoan tien. Bo trong neu ap dung ca don hoac khach chua chi ro.',
          items: {
            type: 'object',
            properties: {
              productId: { type: 'string' },
              productQuery: { type: 'string' },
              name: { type: 'string' },
              quantity: { type: 'number' },
              reason: { type: 'string' }
            }
          }
        },
        name: {
          type: 'string',
          description: 'Ten khach hang neu khach cung cap.'
        },
        email: {
          type: 'string',
          description: 'Email de nhan vien lien he lai. Co the lay tu thong tin don hang neu khach da co email.'
        },
        preferredContactMethod: {
          type: 'string',
          enum: ['email', 'phone', 'zalo', 'facebook', 'chat', 'other'],
          description: 'Kenh lien he khach uu tien.'
        },
        priority: {
          type: 'string',
          enum: ['low', 'normal', 'high', 'urgent'],
          description: 'Muc do uu tien cua yeu cau.'
        }
      },
      required: ['confirmed', 'reason']
    }
  },
  {
    name: 'getSupportTicketStatus',
    label: 'Tra trang thai support ticket',
    description: 'Tra trang thai ticket ho tro da tao tu createSupportTicket, reportBugOrIssue, requestReturnOrRefund, requestPersonalDataExport hoac requestAccountDeletion theo ma ticket. Dung khi khach hoi ticket ho tro, bao loi, su co, doi tra, hoan tien, yeu cau xuat du lieu ca nhan hoac yeu cau xoa tai khoan dang o trang thai nao.',
    group: 'support',
    riskLevel: 'safe',
    requiresConfirmation: false,
    defaultEnabled: true,
    endpoint: 'contactService.getSupportTicketStatus',
    parameters: {
      type: 'object',
      properties: {
        ticketId: {
          type: 'string',
          description: 'Ma ticket da nhan sau khi tao yeu cau, vi du CR-20260428-101530-ABCD.'
        },
        email: {
          type: 'string',
          description: 'Email lien he cua ticket neu khach cung cap, dung de xac minh them khi can.'
        },
        phone: {
          type: 'string',
          description: 'So dien thoai/Zalo lien he cua ticket neu khach cung cap, dung de xac minh them khi can.'
        }
      },
      required: ['ticketId']
    }
  },
  {
    name: 'getStoreConfig',
    label: 'Cau hinh cua hang',
    description: 'Lay cau hinh website cua cua hang, gom ten shop, website, hotline, email, dia chi, gio ho tro va mang xa hoi. Dung khi khach hoi thong tin lien he hoac thong tin cua hang.',
    group: 'support',
    riskLevel: 'safe',
    requiresConfirmation: false,
    defaultEnabled: true,
    endpoint: 'websiteConfigService.getStoreConfig',
    parameters: {
      type: 'object',
      properties: {
        language: {
          type: 'string',
          enum: ['vi', 'en'],
          description: 'Ngon ngu uu tien cho cac truong ho tro co ban dich, mac dinh vi.'
        }
      },
      required: []
    }
  },
  {
    name: 'getSupportInfo',
    label: 'Thong tin ho tro',
    description: 'Lay hotline, email, gio ho tro va mang xa hoi tu website config. Dung khi khach hoi cach lien he, hotline, email, fanpage, Zalo hoac thoi gian ho tro.',
    group: 'support',
    riskLevel: 'safe',
    requiresConfirmation: false,
    defaultEnabled: true,
    endpoint: 'websiteConfigService.getSupportInfo',
    parameters: {
      type: 'object',
      properties: {
        language: {
          type: 'string',
          enum: ['vi', 'en'],
          description: 'Ngon ngu uu tien cho gio ho tro, mac dinh vi.'
        }
      },
      required: []
    }
  },
  {
    name: 'getStoreLocations',
    label: 'Dia diem cua hang',
    description: 'Lay danh sach dia diem, chi nhanh, dia chi cua hang va link ban do tu website config. Dung khi khach hoi cua hang o dau, dia chi, chi nhanh, pickup point, showroom hoac duong di.',
    group: 'support',
    riskLevel: 'safe',
    requiresConfirmation: false,
    defaultEnabled: true,
    endpoint: 'websiteConfigService.getStoreLocations',
    parameters: {
      type: 'object',
      properties: {
        language: {
          type: 'string',
          enum: ['vi', 'en'],
          description: 'Ngon ngu uu tien cho gio hoat dong/ghi chu, mac dinh vi.'
        },
        city: {
          type: 'string',
          description: 'Tinh/thanh pho khach muon loc neu co, vi du: Ha Noi, TP.HCM.'
        },
        keyword: {
          type: 'string',
          description: 'Tu khoa loc theo ten, dia chi, quan/huyen hoac ghi chu cua dia diem.'
        },
        limit: {
          type: 'number',
          description: 'So dia diem toi da muon lay, mac dinh 5 va toi da 10.'
        }
      },
      required: []
    }
  },
  {
    name: 'handoffToHuman',
    label: 'Chuyen nhan vien',
    description: 'Chu dong chuyen cuoc tro chuyen sang nhan vien ho tro khi khach yeu cau gap nguoi that, van de vuot qua kha nang cua AI, can can thiep thu cong, khieu nai, rui ro cao hoac AI khong chac chan. Bat buoc ghi reason cu the de agents biet ly do escalation.',
    group: 'support',
    riskLevel: 'write',
    requiresConfirmation: false,
    defaultEnabled: true,
    endpoint: 'chatService.markEscalation',
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Ly do escalation ngan gon nhung cu the, vi du: "Khach yeu cau gap nhan vien ve don #SM123".'
        },
        summary: {
          type: 'string',
          description: 'Tom tat van de va ngu canh quan trong cho nhan vien neu co.'
        },
        priority: {
          type: 'string',
          enum: ['low', 'normal', 'high', 'urgent'],
          description: 'Muc do uu tien cua yeu cau ho tro.'
        }
      },
      required: ['reason']
    }
  },
  {
    name: 'requestHumanAgent',
    label: 'Yeu cau nhan vien',
    description: 'Alias cua handoffToHuman. Dung de AI yeu cau nhan vien ho tro va ghi reason escalation cu the khi hoi thoai can nguoi that tiep quan.',
    group: 'support',
    riskLevel: 'write',
    requiresConfirmation: false,
    defaultEnabled: true,
    endpoint: 'chatService.markEscalation',
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Ly do escalation ngan gon nhung cu the de nhan vien nam tinh huong.'
        },
        summary: {
          type: 'string',
          description: 'Tom tat van de va ngu canh quan trong cho nhan vien neu co.'
        },
        priority: {
          type: 'string',
          enum: ['low', 'normal', 'high', 'urgent'],
          description: 'Muc do uu tien cua yeu cau ho tro.'
        }
      },
      required: ['reason']
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
 * Tim kiem va loc san pham theo keyword/category/gia/rating/ton kho.
 */
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

function normalizeSearchProductsArgs(args = {}) {
  args = args || {}

  let minPrice = normalizeSearchProductsNumber(args.minPrice)
  let maxPrice = normalizeSearchProductsNumber(args.maxPrice)

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
    const variants = [...new Set([term, removeAccents(term)].map(cleanString).filter(Boolean))]
    const conditions = variants.flatMap(variant => {
      const escaped = escapeRegExp(variant)
      return [
        { title: { $regex: escaped, $options: 'i' } },
        { titleNoAccent: { $regex: escaped, $options: 'i' } }
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

    if (isDirectPurchaseIntent(context) && !hasExplicitCartAddIntent(context)) {
      return JSON.stringify({
        success: false,
        wrongTool: true,
        shouldUseTool: 'placeOrder',
        message: 'Khach dang yeu cau mua/dat hang truc tiep. Hay goi placeOrder voi san pham va so luong da xac dinh, khong chi them vao gio.'
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

    if (!hasExplicitCartRemovalIntent(context)) {
      return JSON.stringify({
        success: false,
        wrongTool: true,
        shouldUseTool: 'placeOrder',
        message: 'Khach khong yeu cau xoa san pham khoi gio. Khong duoc xoa cac mon khac de dat hang; hay dung placeOrder voi dung san pham khach muon mua.'
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
    if (cart.items.length === 0) {
      cart.promoCode = ''
    }
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

async function applyPromoCodeToCart({ code } = {}, context = {}) {
  try {
    const userId = normalizeUserId(context)
    if (!userId) {
      return JSON.stringify({
        success: false,
        requiresLogin: true,
        message: 'Khach can dang nhap de ap ma giam gia vao gio hang.'
      })
    }

    const normalizedCode = cleanString(code).toUpperCase()
    if (!normalizedCode) {
      return JSON.stringify({
        success: false,
        message: 'Vui long cung cap ma giam gia can ap vao gio hang.'
      })
    }

    const currentCart = await buildCartSnapshot(userId, { ignoreStoredPromo: true })
    if (currentCart.distinctItemCount === 0) {
      return JSON.stringify({
        success: false,
        message: 'Gio hang hien dang trong, chua co san pham de ap ma giam gia.',
        cart: currentCart
      })
    }

    if (currentCart.issues.length > 0) {
      return JSON.stringify({
        success: false,
        requiresCartFix: true,
        message: 'Gio hang hien co van de can xu ly truoc khi ap ma giam gia.',
        cart: currentCart
      })
    }

    const promoValidation = parseToolPayload(
      await checkPromoCode({ code: normalizedCode, subtotal: currentCart.subtotal }, { userId })
    )

    if (!promoValidation?.valid || promoValidation.needsSubtotal) {
      return JSON.stringify({
        success: false,
        applied: false,
        message: promoValidation?.message || 'Ma giam gia khong hop le voi gio hang hien tai.',
        promoValidation,
        cart: currentCart
      })
    }

    const cartDoc = await cartRepository.findByUserId(userId)
    if (!cartDoc) {
      return JSON.stringify({
        success: false,
        message: 'Khong tim thay gio hang de ap ma giam gia.'
      })
    }

    cartDoc.promoCode = normalizedCode
    cartDoc.updatedAt = new Date()
    await cartRepository.save(cartDoc)

    const cart = await buildCartSnapshot(userId)

    return JSON.stringify({
      success: true,
      applied: true,
      message: promoValidation.message || `Da ap ma giam gia ${normalizedCode} vao gio hang.`,
      promo: cart.appliedPromo,
      cart
    })
  } catch (err) {
    logger.error('[AI Tool] applyPromoCodeToCart error:', err.message)
    return JSON.stringify({ success: false, error: 'Loi khi ap ma giam gia vao gio hang.' })
  }
}

async function getDeliveryOptions({
  productId,
  productQuery,
  quantity,
  items,
  subtotal,
  promoCode,
  useCart = true
} = {}, context = {}) {
  try {
    const userId = normalizeUserId(context)
    const requestedItems = normalizePlaceOrderItems({ items, productId, productQuery, quantity })
    const explicitSubtotal = normalizeDeliverySubtotal(subtotal)

    let source = 'generic'
    let cart = null
    let deliveryItems = []
    let missingItems = []
    let inferredSubtotal = explicitSubtotal

    if (requestedItems.length > 0) {
      source = 'product_input'
      const result = await buildDeliveryItemsFromProductInputs(requestedItems)
      deliveryItems = result.items
      missingItems = result.missingItems
      if (inferredSubtotal == null && deliveryItems.length > 0) {
        inferredSubtotal = calculateDeliveryItemsSubtotal(deliveryItems)
      }
    } else if (useCart !== false && isMongoObjectId(userId)) {
      cart = await buildCartSnapshot(userId, { promoCode })
      source = cart.distinctItemCount > 0 ? 'current_cart' : 'generic'

      if (cart.distinctItemCount > 0) {
        deliveryItems = await buildDeliveryItemsFromCart(cart)
        if (inferredSubtotal == null) inferredSubtotal = cart.subtotal
      }
    }

    const eta = buildDeliveryEtaSummary(deliveryItems)
    const availability = buildDeliveryAvailability(deliveryItems)
    const shippingEstimate = buildDeliveryShippingEstimate(inferredSubtotal)

    return JSON.stringify({
      found: true,
      message: buildDeliveryOptionsMessage({ source, deliveryItems, missingItems, availability }),
      source,
      deliveryMethods: buildDeliveryMethodOptions({ eta, availability }),
      eta,
      shippingEstimate,
      context: {
        hasProductContext: deliveryItems.length > 0,
        products: deliveryItems,
        missingItems,
        unavailableItems: availability.unavailableItems,
        cart: cart
          ? {
              cartId: cart.cartId,
              itemCount: cart.itemCount,
              distinctItemCount: cart.distinctItemCount,
              subtotal: cart.subtotal,
              subtotalFormatted: cart.subtotalFormatted,
              hasIssues: cart.hasIssues,
              issues: cart.issues,
              promoValidation: cart.promoValidation
            }
          : null
      }
    })
  } catch (err) {
    logger.error('[AI Tool] getDeliveryOptions error:', err.message)
    return JSON.stringify({ found: false, error: 'Loi khi lay phuong thuc nhan hang/giao hang.' })
  }
}

async function removePromoCodeFromCart({ code } = {}, context = {}) {
  try {
    const userId = normalizeUserId(context)
    if (!userId) {
      return JSON.stringify({
        success: false,
        requiresLogin: true,
        message: 'Khach can dang nhap de go ma giam gia khoi gio hang.'
      })
    }

    const normalizedCode = cleanString(code)
    const cartDoc = await cartRepository.findByUserId(userId)
    if (!cartDoc) {
      return JSON.stringify({
        success: false,
        message: 'Khong tim thay gio hang de go ma giam gia.'
      })
    }

    const removedPromoCode = normalizedCode || cleanString(cartDoc.promoCode) || null
    cartDoc.promoCode = ''
    cartDoc.updatedAt = new Date()
    await cartRepository.save(cartDoc)
    const cart = await buildCartSnapshot(userId)

    return JSON.stringify({
      success: true,
      promoRemoved: true,
      removedPromoCode,
      message: removedPromoCode
        ? `Da go ma giam gia ${removedPromoCode} khoi gio hang.`
        : 'Da go ma giam gia khoi gio hang.',
      cart
    })
  } catch (err) {
    logger.error('[AI Tool] removePromoCodeFromCart error:', err.message)
    return JSON.stringify({ success: false, error: 'Loi khi go ma giam gia khoi gio hang.' })
  }
}

async function getCheckoutProfile(args = {}, context = {}) {
  try {
    const userId = normalizeUserId(context)
    if (!isMongoObjectId(userId)) {
      return JSON.stringify({
        found: false,
        requiresLogin: true,
        message: 'Khach can dang nhap de xem thong tin dat hang mac dinh.'
      })
    }

    const user = await userRepository.findById(userId, {
      select: 'fullName email phone checkoutProfile',
      lean: true
    })
    if (!user) {
      return JSON.stringify({
        found: false,
        message: 'Khong tim thay tai khoan khach hang.'
      })
    }

    return JSON.stringify({
      found: true,
      message: 'Da lay thong tin dat hang mac dinh.',
      ...buildCheckoutProfileResponse(user)
    })
  } catch (err) {
    logger.error('[AI Tool] getCheckoutProfile error:', err.message)
    return JSON.stringify({ found: false, error: 'Loi khi lay thong tin dat hang mac dinh.' })
  }
}

async function getUserProfile(args = {}, context = {}) {
  try {
    const userId = normalizeUserId(context)
    if (!isMongoObjectId(userId)) {
      return JSON.stringify({
        found: false,
        requiresLogin: true,
        message: 'Khach can dang nhap de xem thong tin ho so.'
      })
    }

    const user = await userRepository.findById(userId, {
      select: '_id username fullName email phone avatarUrl status lastLogin createdAt updatedAt',
      lean: true
    })
    if (!user) {
      return JSON.stringify({
        found: false,
        message: 'Khong tim thay tai khoan khach hang.'
      })
    }

    return JSON.stringify({
      found: true,
      message: 'Da lay thong tin ho so co ban.',
      profile: buildUserProfileResponse(user)
    })
  } catch (err) {
    logger.error('[AI Tool] getUserProfile error:', err.message)
    return JSON.stringify({ found: false, error: 'Loi khi lay thong tin ho so.' })
  }
}

async function requestPasswordReset(args = {}, context = {}) {
  try {
    const sensitiveFields = ['password', 'newPassword', 'confirmPassword', 'currentPassword', 'code', 'otp']
      .filter(field => cleanString(args?.[field]))
    if (sensitiveFields.length > 0) {
      return JSON.stringify({
        success: false,
        rejectedSensitiveInput: true,
        sensitiveFields,
        message: 'Khong nhan mat khau, ma OTP hoac ma xac thuc trong chat. Vui long dung trang quen mat khau an toan.'
      })
    }

    const email = normalizePasswordResetEmail(args.email || args.accountEmail || context.customerInfo?.email)
    if (!email) {
      return JSON.stringify({
        success: false,
        missingFields: ['email'],
        message: 'Can email tai khoan de gui huong dan dat lai mat khau.'
      })
    }

    const result = await clientUserService.forgotPassword(email)
    const statusCode = Number(result?.statusCode || 500)

    if (statusCode >= 500) {
      return JSON.stringify({
        success: false,
        email,
        resetPageUrl: `${CLIENT_URL}/user/forgot-password`,
        message: 'Chua gui duoc email dat lai mat khau luc nay. Vui long thu lai sau hoac lien he nhan vien ho tro.'
      })
    }

    return JSON.stringify({
      success: true,
      email,
      resetRequested: true,
      accountExistsDisclosed: false,
      resetPageUrl: `${CLIENT_URL}/user/forgot-password`,
      message: 'Neu email nay khop voi tai khoan, he thong se gui ma xac thuc dat lai mat khau. Vui long kiem tra hop thu va hoan tat tren trang quen mat khau.',
      nextSteps: [
        'Mo trang quen mat khau.',
        'Nhap email va ma xac thuc nhan qua email.',
        'Dat mat khau moi tren form bao mat, khong gui mat khau trong chat.'
      ]
    })
  } catch (err) {
    logger.error('[AI Tool] requestPasswordReset error:', err.message)
    return JSON.stringify({
      success: false,
      resetPageUrl: `${CLIENT_URL}/user/forgot-password`,
      message: 'Loi khi khoi tao dat lai mat khau. Vui long thu lai tren trang quen mat khau hoac lien he nhan vien.'
    })
  }
}

async function updateUserProfile(args = {}, context = {}) {
  try {
    const userId = normalizeUserId(context)
    if (!isMongoObjectId(userId)) {
      return JSON.stringify({
        success: false,
        requiresLogin: true,
        message: 'Khach can dang nhap truoc khi cap nhat ho so.'
      })
    }

    const payload = normalizeUserProfileToolArgs(args)
    if (!hasUserProfileMutationInput(payload)) {
      return JSON.stringify({
        success: false,
        message: 'Chua co thong tin ho so nao de cap nhat.'
      })
    }

    const { update, invalidFields } = buildUserProfileUpdate(payload)
    if (invalidFields.length > 0) {
      return JSON.stringify({
        success: false,
        invalidFields,
        message: 'Thong tin ho so chua hop le, vui long kiem tra lai ho ten hoac so dien thoai.'
      })
    }

    const updatedUser = await userRepository.updateById(userId, update, {
      new: true,
      runValidators: true
    })
    if (!updatedUser) {
      return JSON.stringify({
        success: false,
        message: 'Khong tim thay tai khoan khach hang.'
      })
    }

    return JSON.stringify({
      success: true,
      message: 'Da cap nhat ho so khach hang.',
      profile: buildUserProfileResponse(updatedUser)
    })
  } catch (err) {
    logger.error('[AI Tool] updateUserProfile error:', err.message)
    return JSON.stringify({ success: false, error: 'Loi khi cap nhat thong tin ho so.' })
  }
}

async function requestEmailChange(args = {}, context = {}) {
  try {
    const userId = normalizeUserId(context)
    if (!isMongoObjectId(userId)) {
      return JSON.stringify({
        success: false,
        requiresLogin: true,
        message: 'Khach can dang nhap truoc khi doi email.'
      })
    }

    const email = normalizeEmailChangeAddress(args)
    if (!isValidEmailAddress(email)) {
      return JSON.stringify({
        success: false,
        invalidFields: ['email'],
        message: 'Email moi khong hop le.'
      })
    }

    const result = await clientUserService.requestEmailUpdate(userId, email)

    return JSON.stringify(buildEmailChangeServiceResponse(result, {
      email,
      otpSent: result.statusCode >= 200 && result.statusCode < 300,
      expiresInMinutes: 3,
      nextTool: 'verifyEmailChange'
    }))
  } catch (err) {
    logger.error('[AI Tool] requestEmailChange error:', err.message)
    return JSON.stringify({ success: false, error: 'Loi khi gui OTP doi email.' })
  }
}

async function verifyEmailChange(args = {}, context = {}) {
  try {
    const userId = normalizeUserId(context)
    if (!isMongoObjectId(userId)) {
      return JSON.stringify({
        success: false,
        requiresLogin: true,
        message: 'Khach can dang nhap truoc khi xac minh doi email.'
      })
    }

    const email = normalizeEmailChangeAddress(args)
    const code = normalizeEmailChangeCode(args)
    const invalidFields = []

    if (!isValidEmailAddress(email)) invalidFields.push('email')
    if (!/^\d{6}$/.test(code)) invalidFields.push('code')

    if (invalidFields.length > 0) {
      return JSON.stringify({
        success: false,
        invalidFields,
        message: 'Email moi hoac ma OTP khong hop le.'
      })
    }

    const result = await clientUserService.confirmEmailUpdate(userId, { email, code })
    const success = result.statusCode >= 200 && result.statusCode < 300

    return JSON.stringify(buildEmailChangeServiceResponse(result, {
      email,
      emailChanged: success,
      profile: success && result.body?.data ? buildUserProfileResponse(result.body.data) : null
    }))
  } catch (err) {
    logger.error('[AI Tool] verifyEmailChange error:', err.message)
    return JSON.stringify({ success: false, error: 'Loi khi xac minh doi email.' })
  }
}

function normalizeAccountDeletionContact(args = {}, user = {}, context = {}) {
  const contact = args.contact && typeof args.contact === 'object' ? args.contact : {}
  const customerInfo = context.customerInfo || {}
  const email = pickString(args.email, contact.email, user.email, customerInfo.email).toLowerCase()
  const phone = normalizePhone(pickString(args.phone, contact.phone, user.phone, customerInfo.phone))
  const preferredContactMethod = cleanString(args.preferredContactMethod || args.contactMethod).toLowerCase()

  return {
    name: pickString(args.name, args.fullName, contact.name, contact.fullName, user.fullName, customerInfo.name, user.username),
    email,
    phone,
    preferredContactMethod: ['email', 'phone', 'chat'].includes(preferredContactMethod)
      ? preferredContactMethod
      : (email ? 'email' : (phone ? 'phone' : 'chat'))
  }
}

function buildAccountDeletionMessage({ args = {}, user = {}, reason = '', context = {} } = {}) {
  const currentPage = cleanString(args.currentPage || context.customerInfo?.currentPage)

  return [
    'Loai yeu cau: Xoa tai khoan khach hang',
    `UserId: ${serializeId(user._id || user.id)}`,
    `Username: ${cleanString(user.username) || '(khong co)'}`,
    `Email tai khoan: ${cleanString(user.email) || '(khong co)'}`,
    `So dien thoai tai khoan: ${cleanString(user.phone) || '(khong co)'}`,
    `Trang thai tai khoan: ${cleanString(user.status) || '(khong ro)'}`,
    currentPage ? `Trang hien tai: ${currentPage}` : null,
    '',
    `Ly do/ghi chu cua khach: ${reason || 'Khach yeu cau xoa tai khoan qua chat.'}`,
    cleanString(args.details) ? `Chi tiet bo sung: ${cleanString(args.details)}` : null,
    '',
    'Khach da xac nhan gui yeu cau trong chat. Tool nay chi tao ticket, khong tu dong xoa tai khoan.',
    'Can nhan vien xac minh danh tinh, kiem tra nghia vu don hang/thanh toan va xu ly du lieu theo quy trinh truoc khi xoa.'
  ].filter(line => line !== null).join('\n')
}

function buildAccountDeletionResponse(result = {}, args = {}, meta = {}) {
  const request = result.request || {}
  const ticketId = result.ticketId || request.ticketId || null

  return {
    ...result,
    success: true,
    ticketCreated: true,
    accountDeletionRequested: true,
    accountDeleted: false,
    deletionScheduled: false,
    handoffRequested: false,
    escalate: false,
    ticketId,
    ticket: {
      ticketId,
      category: request.category || 'account',
      priority: request.priority || 'high',
      subject: request.subject || meta.subject || null,
      preferredContactMethod: request.preferredContactMethod || meta.contact?.preferredContactMethod || null,
      createdAt: request.createdAt || null
    },
    customer: {
      userId: serializeId(meta.user?._id || meta.user?.id),
      username: cleanString(meta.user?.username),
      email: cleanString(meta.user?.email),
      status: cleanString(meta.user?.status)
    },
    summary: meta.subject || 'Yeu cau xoa tai khoan',
    priority: request.priority || 'high',
    message: `Minh da ghi nhan yeu cau xoa tai khoan${ticketId ? ` ${ticketId}` : ''}. Nhan vien se xac minh va xu ly theo quy trinh; tai khoan chua bi xoa ngay trong chat.`,
    nextAction: 'account_deletion_follow_up'
  }
}

async function requestAccountDeletion(args = {}, context = {}) {
  try {
    const userId = normalizeUserId(context)
    if (!isMongoObjectId(userId)) {
      return JSON.stringify({
        success: false,
        requiresLogin: true,
        message: 'Khach can dang nhap truoc khi gui yeu cau xoa tai khoan.'
      })
    }

    const user = await userRepository.findById(userId, {
      select: '_id username fullName email phone status deleted deletedAt',
      lean: true
    })
    if (!user || user.deleted === true) {
      return JSON.stringify({
        success: false,
        message: 'Khong tim thay tai khoan khach hang dang hoat dong de gui yeu cau xoa.'
      })
    }

    const contactService = require('../client/contact.service')
    const contact = normalizeAccountDeletionContact(args, user, context)
    const reason = truncateHandoffText(
      pickString(args.reason, args.details, args.message, context.promptText) || 'Khach yeu cau xoa tai khoan qua chat.',
      800
    )
    const subject = truncateHandoffText(
      `[Yeu cau xoa tai khoan] ${cleanString(user.username) || cleanString(user.email) || userId}`,
      180
    )
    const message = buildAccountDeletionMessage({ args, user, reason, context })
    const result = await contactService.submitContactRequest({
      ...contact,
      subject,
      message,
      category: 'account',
      priority: 'high',
      currentPage: cleanString(args.currentPage || context.customerInfo?.currentPage),
      source: 'chatbot_account_deletion_request'
    }, {
      ...context,
      source: 'chatbot_account_deletion_request'
    })

    return JSON.stringify(buildAccountDeletionResponse(result, args, {
      user,
      contact,
      subject
    }))
  } catch (err) {
    if (err.statusCode === 400) {
      logger.warn(`[AI Tool] requestAccountDeletion validation: ${err.message}`)
      return JSON.stringify({
        success: false,
        ticketCreated: false,
        accountDeletionRequested: false,
        handoffRequested: false,
        escalate: false,
        requiresContactInfo: /email|so dien thoai|phone/i.test(err.message),
        message: err.message,
        error: 'ACCOUNT_DELETION_REQUEST_VALIDATION_FAILED'
      })
    }

    logger.error('[AI Tool] requestAccountDeletion error:', err.message)
    return JSON.stringify({
      success: false,
      ticketCreated: false,
      accountDeletionRequested: false,
      handoffRequested: false,
      escalate: false,
      message: 'Minh chua tao duoc yeu cau xoa tai khoan luc nay. Ban vui long thu lai hoac yeu cau gap nhan vien ho tro.',
      error: 'ACCOUNT_DELETION_REQUEST_FAILED'
    })
  }
}

async function getNotificationPreferences(args = {}, context = {}) {
  try {
    const userId = normalizeUserId(context)
    if (!isMongoObjectId(userId)) {
      return JSON.stringify({
        found: false,
        requiresLogin: true,
        message: 'Khach can dang nhap de xem tuy chon thong bao.'
      })
    }

    const user = await userRepository.findById(userId, {
      select: 'notificationPreferences',
      lean: true
    })
    if (!user) {
      return JSON.stringify({
        found: false,
        message: 'Khong tim thay tai khoan khach hang.'
      })
    }

    return JSON.stringify({
      found: true,
      message: 'Da lay tuy chon thong bao.',
      ...buildNotificationPreferencesResponse(user)
    })
  } catch (err) {
    logger.error('[AI Tool] getNotificationPreferences error:', err.message)
    return JSON.stringify({ found: false, error: 'Loi khi lay tuy chon thong bao.' })
  }
}

async function updateCheckoutProfile(args = {}, context = {}) {
  try {
    const userId = normalizeUserId(context)
    if (!isMongoObjectId(userId)) {
      return JSON.stringify({
        success: false,
        requiresLogin: true,
        message: 'Khach can dang nhap truoc khi luu thong tin dat hang mac dinh.'
      })
    }

    const payload = normalizeCheckoutProfileToolArgs(args)
    if (!hasCheckoutProfileMutationInput(payload)) {
      return JSON.stringify({
        success: false,
        message: 'Chua co thong tin dat hang mac dinh nao de cap nhat.'
      })
    }

    const user = await userRepository.findById(userId, {
      select: 'fullName email phone checkoutProfile',
      lean: true
    })
    if (!user) {
      return JSON.stringify({
        success: false,
        message: 'Khong tim thay tai khoan khach hang.'
      })
    }

    const checkoutProfile = buildCheckoutProfileUpdate(payload, user.checkoutProfile || {})
    const invalidFields = getInvalidCheckoutProfileFields(checkoutProfile)
    if (invalidFields.length > 0) {
      return JSON.stringify({
        success: false,
        invalidFields,
        message: 'Thong tin dat hang mac dinh chua hop le, vui long kiem tra lai so dien thoai hoac email.'
      })
    }

    const updatedUser = await userRepository.updateById(userId, { checkoutProfile }, { new: true })
    if (!updatedUser) {
      return JSON.stringify({
        success: false,
        message: 'Khong tim thay tai khoan khach hang.'
      })
    }

    return JSON.stringify({
      success: true,
      message: 'Da luu thong tin dat hang mac dinh.',
      ...buildCheckoutProfileResponse(updatedUser)
    })
  } catch (err) {
    logger.error('[AI Tool] updateCheckoutProfile error:', err.message)
    return JSON.stringify({ success: false, error: 'Loi khi cap nhat thong tin dat hang mac dinh.' })
  }
}

async function updateNotificationPreferences(args = {}, context = {}) {
  try {
    const userId = normalizeUserId(context)
    if (!isMongoObjectId(userId)) {
      return JSON.stringify({
        success: false,
        requiresLogin: true,
        message: 'Khach can dang nhap truoc khi luu tuy chon thong bao.'
      })
    }

    const payload = normalizeNotificationPreferenceArgs(args)
    if (!hasNotificationPreferencesMutationInput(payload)) {
      return JSON.stringify({
        success: false,
        message: 'Chua co tuy chon thong bao hop le nao de cap nhat.'
      })
    }

    const user = await userRepository.findById(userId, {
      select: 'notificationPreferences',
      lean: true
    })
    if (!user) {
      return JSON.stringify({
        success: false,
        message: 'Khong tim thay tai khoan khach hang.'
      })
    }

    const notificationPreferences = buildNotificationPreferencesUpdate(payload, user.notificationPreferences || {})
    const updatedUser = await userRepository.updateById(
      userId,
      { notificationPreferences },
      { new: true }
    )
    if (!updatedUser) {
      return JSON.stringify({
        success: false,
        message: 'Khong tim thay tai khoan khach hang.'
      })
    }

    return JSON.stringify({
      success: true,
      message: 'Da luu tuy chon thong bao.',
      ...buildNotificationPreferencesResponse(updatedUser)
    })
  } catch (err) {
    logger.error('[AI Tool] updateNotificationPreferences error:', err.message)
    return JSON.stringify({ success: false, error: 'Loi khi cap nhat tuy chon thong bao.' })
  }
}

async function placeOrder({
  contact = {},
  productId,
  productQuery,
  quantity,
  items,
  deliveryMethod,
  paymentMethod,
  promoCode,
  shipping
} = {}, context = {}) {
  try {
    const userId = normalizeUserId(context)
    if (!isMongoObjectId(userId)) {
      return JSON.stringify({
        success: false,
        requiresLogin: true,
        message: 'Khach can dang nhap truoc khi dat hang.'
      })
    }

    const explicitPaymentMethod = cleanString(paymentMethod).toLowerCase()
    if (['transfer', 'contact'].includes(explicitPaymentMethod)) {
      return JSON.stringify({
        success: false,
        unsupportedPaymentMethod: explicitPaymentMethod,
        supportedPaymentMethods: PLACE_ORDER_PAYMENT_METHODS,
        message: 'Hien tam tat thanh toan chuyen khoan/thoa thuan. Vui long chon thanh toan online qua VNPay, MoMo, ZaloPay hoac Sepay.'
      })
    }

    const requestedItems = normalizePlaceOrderItems({ items, productId, productQuery, quantity })
    const isDirectOrder = requestedItems.length > 0
    const orderItemResult = isDirectOrder
      ? await buildDirectOrderItems(requestedItems)
      : await buildCartOrderItems(userId, { promoCode })
    if (orderItemResult.error) {
      return JSON.stringify(orderItemResult.error)
    }

    const cart = orderItemResult.cart || null
    const normalizedOrderItems = orderItemResult.orderItems

    const user = await userRepository.findById(userId, {
      select: 'fullName email phone checkoutProfile',
      lean: true
    })
    const orderContact = buildOrderContact({ contact, user })
    const missingFields = getMissingOrderContactFields(orderContact)

    if (missingFields.length > 0) {
      return JSON.stringify({
        success: false,
        missingContactFields: missingFields,
        message: 'Can bo sung ho, ten va so dien thoai truoc khi dat hang.',
        contact: orderContact,
        cart
      })
    }

    const invalidFields = getInvalidOrderContactFields(orderContact)
    if (invalidFields.length > 0) {
      return JSON.stringify({
        success: false,
        invalidContactFields: invalidFields,
        message: 'Thong tin lien he chua hop le, vui long kiem tra lai so dien thoai hoac email.',
        contact: orderContact,
        cart
      })
    }

    const selectedPaymentMethod = normalizeOnlinePaymentMethod(explicitPaymentMethod || user?.checkoutProfile?.paymentMethod)
    const selectedDeliveryMethod = normalizeEnum(
      deliveryMethod || user?.checkoutProfile?.deliveryMethod,
      PLACE_ORDER_DELIVERY_METHODS,
      'pickup'
    )
    const subtotal = calculateOrderItemsSubtotal(normalizedOrderItems)
    const normalizedShipping = normalizeShipping(shipping, subtotal)
    const effectivePromoCode = isDirectOrder
      ? cleanString(promoCode)
      : (cleanString(promoCode) || cleanString(cart?.appliedPromo?.code) || cleanString(cart?.promoCode))

    const orderResult = await ordersService.createPendingOrder(userId, {
      contact: orderContact,
      orderItems: normalizedOrderItems,
      deliveryMethod: selectedDeliveryMethod,
      paymentMethod: selectedPaymentMethod,
      shipping: normalizedShipping,
      promo: effectivePromoCode,
      subtotal,
      total: subtotal + normalizedShipping
    })

    const orderId = orderResult.orderId?.toString()
    const payment = await createOnlinePaymentRequest(selectedPaymentMethod, orderId, userId, orderResult.paymentReference)
    const order = await orderRepository.findById(orderId)

    const paymentMessage = payment.paymentUrl
      ? `Da tao don hang ${formatOrderCode(order)} cho thanh toan online. Vui long mo link thanh toan de hoan tat don.`
      : `Da tao don hang ${formatOrderCode(order)} cho Sepay. Vui long chuyen khoan dung so tien va noi dung ${payment.paymentReference} de he thong tu xac nhan.`

    return JSON.stringify({
      success: true,
      requiresPayment: true,
      message: paymentMessage,
      order: buildOrderPayload(order),
      payment,
      cart: isDirectOrder ? null : cart
    })
  } catch (err) {
    logger.error('[AI Tool] placeOrder error:', err.stack || err.message)
    return JSON.stringify({
      success: false,
      message: err.message || 'Loi khi tao don hang.',
      error: 'Loi khi tao don hang.'
    })
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
    cart.promoCode = ''
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

async function getWishlist({ page, limit } = {}, context = {}) {
  try {
    const userId = normalizeUserId(context)
    if (!userId) {
      return JSON.stringify({
        found: false,
        requiresLogin: true,
        message: 'Khach can dang nhap de xem danh sach yeu thich.'
      })
    }

    const wishlist = await buildWishlistSnapshot(userId, { page, limit })

    return JSON.stringify({
      found: true,
      empty: wishlist.totalItems === 0,
      message: wishlist.totalItems === 0 ? 'Danh sach yeu thich hien dang trong.' : null,
      wishlist
    })
  } catch (err) {
    logger.error('[AI Tool] getWishlist error:', err.message)
    return JSON.stringify({ found: false, error: 'Loi khi lay danh sach yeu thich.' })
  }
}

async function addToWishlist({ productId, productQuery } = {}, context = {}) {
  try {
    const userId = normalizeUserId(context)
    if (!userId) {
      return JSON.stringify({
        success: false,
        requiresLogin: true,
        message: 'Khach can dang nhap truoc khi them san pham vao danh sach yeu thich.'
      })
    }

    const { product } = await resolveWishlistProductInput({ productId, productQuery })
    if (!isSellableProduct(product)) {
      return JSON.stringify({
        success: false,
        message: `Khong tim thay san pham "${productQuery || productId || ''}" de them vao danh sach yeu thich.`
      })
    }

    const wishlist = await getOrCreateWishlist(userId)
    const exists = findWishlistItemIndex(wishlist.items, product._id.toString()) >= 0
    if (exists) {
      return JSON.stringify({
        success: true,
        alreadyExists: true,
        message: `${product.title} da co trong danh sach yeu thich.`,
        wishlist: await buildWishlistSnapshot(userId)
      })
    }

    wishlist.items.unshift({ productId: product._id })
    await wishlistRepository.save(wishlist)

    return JSON.stringify({
      success: true,
      added: true,
      message: `Da them ${product.title} vao danh sach yeu thich.`,
      wishlist: await buildWishlistSnapshot(userId)
    })
  } catch (err) {
    logger.error('[AI Tool] addToWishlist error:', err.message)
    return JSON.stringify({ success: false, error: 'Loi khi them san pham vao danh sach yeu thich.' })
  }
}

async function removeFromWishlist({ productId, productQuery } = {}, context = {}) {
  try {
    const userId = normalizeUserId(context)
    if (!userId) {
      return JSON.stringify({
        success: false,
        requiresLogin: true,
        message: 'Khach can dang nhap truoc khi xoa san pham khoi danh sach yeu thich.'
      })
    }

    const wishlist = await wishlistRepository.findByUserId(userId)
    if (!wishlist || !Array.isArray(wishlist.items) || wishlist.items.length === 0) {
      return JSON.stringify({
        success: false,
        message: 'Danh sach yeu thich hien dang trong.'
      })
    }

    const { product, targetProductId } = await resolveWishlistProductInput({ productId, productQuery })
    const itemIndex = findWishlistItemIndex(wishlist.items, targetProductId)
    if (itemIndex < 0) {
      return JSON.stringify({
        success: false,
        message: 'Khong tim thay san pham can xoa trong danh sach yeu thich.'
      })
    }

    const removedItem = wishlist.items[itemIndex]
    const removedProduct = product || await productRepository.findById(removedItem.productId, { lean: true })
    const removedName = removedProduct?.title || productQuery || productId || 'san pham'

    wishlist.items.splice(itemIndex, 1)
    await wishlistRepository.save(wishlist)

    return JSON.stringify({
      success: true,
      removed: true,
      message: `Da xoa ${removedName} khoi danh sach yeu thich.`,
      wishlist: await buildWishlistSnapshot(userId)
    })
  } catch (err) {
    logger.error('[AI Tool] removeFromWishlist error:', err.message)
    return JSON.stringify({ success: false, error: 'Loi khi xoa san pham khoi danh sach yeu thich.' })
  }
}

async function toggleWishlist({ productId, productQuery } = {}, context = {}) {
  try {
    const userId = normalizeUserId(context)
    if (!userId) {
      return JSON.stringify({
        success: false,
        requiresLogin: true,
        message: 'Khach can dang nhap truoc khi cap nhat danh sach yeu thich.'
      })
    }

    const wishlist = await getOrCreateWishlist(userId)
    const { product, targetProductId } = await resolveWishlistProductInput({ productId, productQuery })
    if (!targetProductId) {
      return JSON.stringify({
        success: false,
        message: `Khong tim thay san pham "${productQuery || productId || ''}" de cap nhat danh sach yeu thich.`
      })
    }

    const existingIndex = findWishlistItemIndex(wishlist.items, targetProductId)
    let added = false
    let productName = product?.title || productQuery || productId || 'san pham'

    if (existingIndex >= 0) {
      const removedItem = wishlist.items[existingIndex]
      if (!product) {
        const removedProduct = await productRepository.findById(removedItem.productId, { lean: true })
        productName = removedProduct?.title || productName
      }
      wishlist.items.splice(existingIndex, 1)
    } else {
      if (!isSellableProduct(product)) {
        return JSON.stringify({
          success: false,
          message: `Khong tim thay san pham "${productQuery || productId || ''}" de them vao danh sach yeu thich.`
        })
      }

      wishlist.items.unshift({ productId: product._id })
      productName = product.title
      added = true
    }

    await wishlistRepository.save(wishlist)

    return JSON.stringify({
      success: true,
      added,
      removed: !added,
      message: added
        ? `Da them ${productName} vao danh sach yeu thich.`
        : `Da xoa ${productName} khoi danh sach yeu thich.`,
      wishlist: await buildWishlistSnapshot(userId)
    })
  } catch (err) {
    logger.error('[AI Tool] toggleWishlist error:', err.message)
    return JSON.stringify({ success: false, error: 'Loi khi cap nhat danh sach yeu thich.' })
  }
}

async function clearWishlist(args = {}, context = {}) {
  try {
    const userId = normalizeUserId(context)
    if (!userId) {
      return JSON.stringify({
        success: false,
        requiresLogin: true,
        message: 'Khach can dang nhap truoc khi xoa danh sach yeu thich.'
      })
    }

    const wishlist = await wishlistRepository.findByUserId(userId)
    if (!wishlist || !Array.isArray(wishlist.items) || wishlist.items.length === 0) {
      return JSON.stringify({
        success: true,
        message: 'Danh sach yeu thich da trong san.',
        wishlist: await buildWishlistSnapshot(userId)
      })
    }

    wishlist.items = []
    await wishlistRepository.save(wishlist)

    return JSON.stringify({
      success: true,
      message: 'Da xoa toan bo danh sach yeu thich.',
      wishlist: await buildWishlistSnapshot(userId)
    })
  } catch (err) {
    logger.error('[AI Tool] clearWishlist error:', err.message)
    return JSON.stringify({ success: false, error: 'Loi khi xoa toan bo danh sach yeu thich.' })
  }
}

async function buildCartSnapshot(userId, { promoCode, ignoreStoredPromo = false } = {}) {
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
      promoCode: null,
      appliedPromo: null,
      discount: 0,
      discountFormatted: formatPrice(0),
      estimatedTotal: 0,
      estimatedTotalFormatted: formatPrice(0),
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
      isFlashSale: !!item.isFlashSale,
      flashSaleId: item.flashSaleId ? item.flashSaleId.toString() : null,
      salePrice: item.salePrice != null ? Number(item.salePrice) : null,
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
  const storedPromoCode = ignoreStoredPromo ? '' : cleanString(cart.promoCode)
  const requestedPromoCode = typeof promoCode === 'string' ? cleanString(promoCode) : ''
  const effectivePromoCode = requestedPromoCode || storedPromoCode
  let promoValidation = null
  let appliedPromo = null
  let discount = 0

  if (effectivePromoCode) {
    promoValidation = parseToolPayload(
      await checkPromoCode({ code: effectivePromoCode, subtotal }, { userId })
    )

    if (promoValidation?.valid === false) {
      issues.push({
        code: 'promo_invalid',
        message: promoValidation.message || 'Ma giam gia khong hop le voi gio hang hien tai.'
      })
    } else if (promoValidation?.valid === true && !promoValidation.needsSubtotal) {
      discount = Number(promoValidation.discount || 0)
      appliedPromo = {
        code: promoValidation.promo?.code || effectivePromoCode,
        discount,
        discountFormatted: promoValidation.discountFormatted || formatPrice(discount),
        estimatedTotalFormatted: promoValidation.estimatedTotalFormatted || formatPrice(Math.max(0, subtotal - discount)),
        promo: promoValidation.promo || null
      }
    }
  }
  const estimatedTotal = Math.max(0, subtotal - discount)

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
    promoCode: effectivePromoCode || null,
    appliedPromo,
    discount,
    discountFormatted: formatPrice(discount),
    estimatedTotal,
    estimatedTotalFormatted: formatPrice(estimatedTotal),
    promoValidation
  }
}

function normalizeWishlistPage(value) {
  return Math.max(Number(value) || 1, 1)
}

function normalizeWishlistLimit(value) {
  return Math.min(Math.max(Number(value) || DEFAULT_WISHLIST_LIMIT, 1), MAX_WISHLIST_LIMIT)
}

async function getOrCreateWishlist(userId) {
  let wishlist = await wishlistRepository.findByUserId(userId)
  if (!wishlist) wishlist = await wishlistRepository.createForUser(userId)
  return wishlist
}

function buildWishlistProductPayload(item, product) {
  if (!product) return null

  const finalPrice = calculateEffectiveProductPrice(product)
  return {
    productId: item.productId.toString(),
    name: product.title,
    slug: product.slug,
    originalPrice: Number(product.price || 0),
    originalPriceFormatted: formatPrice(product.price || 0),
    finalPrice,
    finalPriceFormatted: formatPrice(finalPrice),
    discount: product.discountPercentage ? `${product.discountPercentage}%` : null,
    discountPercentage: product.discountPercentage || 0,
    stock: product.stock || 0,
    inStock: Number(product.stock || 0) > 0,
    image: product.thumbnail || null,
    rating: product.rate || null,
    url: product.slug ? `${CLIENT_URL}/products/${product.slug}` : null
  }
}

async function buildWishlistSnapshot(userId, { page, limit } = {}) {
  const currentPage = normalizeWishlistPage(page)
  const currentLimit = normalizeWishlistLimit(limit)
  const skip = (currentPage - 1) * currentLimit
  const wishlist = await wishlistRepository.findByUserId(userId)

  if (!wishlist || !Array.isArray(wishlist.items) || wishlist.items.length === 0) {
    return {
      wishlistId: wishlist?._id?.toString() || null,
      page: currentPage,
      limit: currentLimit,
      totalItems: 0,
      totalPages: 0,
      hasMore: false,
      items: []
    }
  }

  const allItems = [...wishlist.items].reverse()
  const totalItems = allItems.length
  const pagedItems = allItems.slice(skip, skip + currentLimit)
  const productIds = pagedItems.map(item => item.productId)
  const products = await productRepository.findByQuery(
    { _id: { $in: productIds }, deleted: { $ne: true } },
    {
      select: 'title price discountPercentage stock thumbnail slug rate status deleted',
      lean: true
    }
  )
  const productMap = new Map(products.map(product => [product._id.toString(), product]))

  return {
    wishlistId: wishlist._id?.toString() || null,
    page: currentPage,
    limit: currentLimit,
    totalItems,
    totalPages: Math.ceil(totalItems / currentLimit),
    hasMore: currentPage * currentLimit < totalItems,
    items: pagedItems
      .map(item => buildWishlistProductPayload(item, productMap.get(item.productId.toString())))
      .filter(Boolean)
  }
}

function findWishlistItemIndex(items = [], targetProductId) {
  const normalizedId = cleanString(targetProductId)
  if (!normalizedId) return -1

  return items.findIndex(item => item.productId?.toString() === normalizedId)
}

async function resolveWishlistProductInput({ productId, productQuery } = {}) {
  const product = await resolveProductForCartInput({ productId, productQuery })
  const targetProductId = product?._id
    ? product._id.toString()
    : (isMongoObjectId(productId) ? cleanString(productId) : '')

  return { product, targetProductId }
}

function normalizePolicyLanguage(language, context = {}) {
  const rawLanguage = language || context?.language || context?.customerInfo?.language || context?.customerInfo?.lang
  return String(rawLanguage || '').toLowerCase().startsWith('en') ? 'en' : 'vi'
}

function normalizePolicyLimit(limit) {
  return Math.min(Math.max(Number(limit) || DEFAULT_POLICY_SEARCH_LIMIT, 1), MAX_POLICY_SEARCH_LIMIT)
}

function normalizePolicySourceName(source) {
  const normalized = normalizeSearchText(source)
  if (!normalized) return null

  if (['faq', 'faqs', 'hoi dap', 'cau hoi thuong gap'].includes(normalized)) return 'faq'
  if (['return', 'returns', 'refund', 'refunds', 'returnpolicy', 'doi tra', 'hoan tien', 'chinh sach doi tra'].includes(normalized)) return 'returnPolicy'
  if (['privacy', 'privacypolicy', 'bao mat', 'du lieu ca nhan', 'chinh sach bao mat'].includes(normalized)) return 'privacyPolicy'
  if (['terms', 'term', 'tos', 'termscontent', 'terms of service', 'dieu khoan', 'dieu khoan su dung'].includes(normalized)) return 'terms'

  return POLICY_SOURCES.includes(source) ? source : null
}

function normalizePolicySources(sources) {
  const rawSources = Array.isArray(sources)
    ? sources
    : (typeof sources === 'string' ? sources.split(',') : [])
  const normalizedSources = rawSources
    .map(source => normalizePolicySourceName(source))
    .filter(Boolean)

  return normalizedSources.length > 0
    ? [...new Set(normalizedSources)]
    : POLICY_SOURCES
}

function normalizeSearchText(value = '') {
  return removeAccents(String(value || '').toLowerCase())
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function formatPolicyPath(path = []) {
  return path
    .filter(part => !/^\d+$/.test(String(part)))
    .map(part => String(part).replace(/([a-z])([A-Z])/g, '$1 $2'))
    .join(' > ')
}

function isPlainPolicyObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function getPolicyTitle(node = {}, inheritedTitle = '', path = []) {
  return pickString(
    node.question,
    node.title,
    node.label,
    node.method,
    node.category,
    node.name,
    inheritedTitle,
    formatPolicyPath(path)
  )
}

function extractDirectPolicyText(node = {}) {
  const textParts = []

  Object.entries(node).forEach(([key, value]) => {
    if (['_id', '__v', 'id', 'key', 'url', 'callUrl', 'emailUrl', 'faqUrl'].includes(key)) return

    if (typeof value === 'string' && value.trim()) {
      textParts.push(value.trim())
      return
    }

    if (Array.isArray(value) && value.every(item => typeof item === 'string')) {
      textParts.push(...value.map(item => item.trim()).filter(Boolean))
    }
  })

  return textParts
}

function collectPolicyEntries(node, {
  source,
  path = [],
  inheritedTitle = '',
  entries = []
} = {}) {
  if (Array.isArray(node)) {
    node.forEach((item, index) => {
      collectPolicyEntries(item, {
        source,
        path: [...path, index],
        inheritedTitle,
        entries
      })
    })
    return entries
  }

  if (isPlainPolicyObject(node)) {
    const title = getPolicyTitle(node, inheritedTitle, path)
    const directText = extractDirectPolicyText(node)

    if (directText.length > 0) {
      entries.push({
        source,
        sourceLabel: POLICY_SOURCE_META[source]?.label || source,
        title,
        path: formatPolicyPath(path),
        text: [...new Set(directText)].join(' '),
        url: POLICY_SOURCE_META[source]?.url || null
      })
    }

    Object.entries(node).forEach(([key, value]) => {
      if (typeof value === 'string') return
      if (Array.isArray(value) && value.every(item => typeof item === 'string')) return

      collectPolicyEntries(value, {
        source,
        path: [...path, key],
        inheritedTitle: title,
        entries
      })
    })
  }

  return entries
}

function scorePolicyEntry(entry, query) {
  const normalizedQuery = normalizeSearchText(query)
  if (!normalizedQuery) return 1

  const haystack = normalizeSearchText(`${entry.sourceLabel} ${entry.title} ${entry.path} ${entry.text}`)
  const terms = normalizedQuery.split(/\s+/).filter(term => term.length > 1)
  let score = haystack.includes(normalizedQuery) ? 20 : 0

  terms.forEach(term => {
    if (haystack.includes(term)) score += 1
  })

  if (normalizeSearchText(entry.title).includes(normalizedQuery)) score += 8
  return score
}

function buildPolicyResult(entry, query = '') {
  return {
    source: entry.source,
    sourceLabel: entry.sourceLabel,
    title: entry.title,
    path: entry.path,
    excerpt: excerptText(entry.text, 280),
    url: entry.url,
    score: scorePolicyEntry(entry, query)
  }
}

async function getPolicySourceContent(source, language) {
  if (source === 'faq') {
    return (await faqPageService.getClientFaqPage(language))?.data || {}
  }

  if (source === 'returnPolicy') {
    return (await returnPolicyPageService.getClientReturnPolicyPage(language))?.data || {}
  }

  if (source === 'privacyPolicy') {
    return (await privacyPolicyPageService.getClientPrivacyPolicyPage(language))?.data || {}
  }

  if (source === 'terms') {
    return (await termsContentService.getTermsContent(language))?.data || {}
  }

  return {}
}

async function buildPolicyEntries({ sources = POLICY_SOURCES, language = 'vi' } = {}) {
  const entriesBySource = await Promise.all(
    sources.map(async source => {
      const content = await getPolicySourceContent(source, language)
      return collectPolicyEntries(content, { source })
    })
  )

  return entriesBySource.flat()
}

function filterPolicyEntries(entries = [], query = '', limit = DEFAULT_POLICY_SEARCH_LIMIT) {
  const normalizedLimit = normalizePolicyLimit(limit)
  const scoredEntries = entries
    .map(entry => ({ ...entry, score: scorePolicyEntry(entry, query) }))
    .filter(entry => !query || entry.score > 0)
    .sort((left, right) => right.score - left.score)

  return scoredEntries
    .slice(0, normalizedLimit)
    .map(entry => buildPolicyResult(entry, query))
}

async function searchPolicies({ query, sources, language, limit } = {}, context = {}) {
  try {
    const normalizedLanguage = normalizePolicyLanguage(language, context)
    const selectedSources = normalizePolicySources(sources)
    const entries = await buildPolicyEntries({
      sources: selectedSources,
      language: normalizedLanguage
    })
    const results = filterPolicyEntries(entries, query, limit)

    return JSON.stringify({
      found: results.length > 0,
      query: cleanString(query),
      language: normalizedLanguage,
      sources: selectedSources,
      count: results.length,
      results,
      message: results.length > 0
        ? null
        : 'Khong tim thay noi dung chinh sach phu hop voi cau hoi nay.'
    })
  } catch (err) {
    logger.error('[AI Tool] searchPolicies error:', err.message)
    return JSON.stringify({ found: false, error: 'Loi khi tim noi dung chinh sach.' })
  }
}

async function getReturnPolicy({ topic, language, limit } = {}, context = {}) {
  try {
    const normalizedLanguage = normalizePolicyLanguage(language, context)
    const entries = await buildPolicyEntries({
      sources: ['returnPolicy'],
      language: normalizedLanguage
    })
    const results = filterPolicyEntries(entries, topic, limit)

    return JSON.stringify({
      found: results.length > 0,
      topic: cleanString(topic),
      language: normalizedLanguage,
      source: 'returnPolicy',
      sourceLabel: POLICY_SOURCE_META.returnPolicy.label,
      url: POLICY_SOURCE_META.returnPolicy.url,
      count: results.length,
      results,
      message: results.length > 0
        ? null
        : 'Chua co noi dung chinh sach doi tra phu hop.'
    })
  } catch (err) {
    logger.error('[AI Tool] getReturnPolicy error:', err.message)
    return JSON.stringify({ found: false, error: 'Loi khi lay chinh sach doi tra.' })
  }
}

async function getPrivacyPolicy({ topic, language, limit } = {}, context = {}) {
  try {
    const normalizedLanguage = normalizePolicyLanguage(language, context)
    const entries = await buildPolicyEntries({
      sources: ['privacyPolicy'],
      language: normalizedLanguage
    })
    const results = filterPolicyEntries(entries, topic, limit)

    return JSON.stringify({
      found: results.length > 0,
      topic: cleanString(topic),
      language: normalizedLanguage,
      source: 'privacyPolicy',
      sourceLabel: POLICY_SOURCE_META.privacyPolicy.label,
      url: POLICY_SOURCE_META.privacyPolicy.url,
      count: results.length,
      results,
      message: results.length > 0
        ? null
        : 'Chua co noi dung chinh sach bao mat phu hop.'
    })
  } catch (err) {
    logger.error('[AI Tool] getPrivacyPolicy error:', err.message)
    return JSON.stringify({ found: false, error: 'Loi khi lay chinh sach bao mat.' })
  }
}

async function getTermsOfService({ topic, language, limit } = {}, context = {}) {
  try {
    const normalizedLanguage = normalizePolicyLanguage(language, context)
    const entries = await buildPolicyEntries({
      sources: ['terms'],
      language: normalizedLanguage
    })
    const results = filterPolicyEntries(entries, topic, limit)

    return JSON.stringify({
      found: results.length > 0,
      topic: cleanString(topic),
      language: normalizedLanguage,
      source: 'terms',
      sourceLabel: POLICY_SOURCE_META.terms.label,
      url: POLICY_SOURCE_META.terms.url,
      count: results.length,
      results,
      message: results.length > 0
        ? null
        : 'Chua co noi dung dieu khoan su dung phu hop.'
    })
  } catch (err) {
    logger.error('[AI Tool] getTermsOfService error:', err.message)
    return JSON.stringify({ found: false, error: 'Loi khi lay dieu khoan su dung.' })
  }
}

async function getFAQ({ question, language, limit } = {}, context = {}) {
  try {
    const normalizedLanguage = normalizePolicyLanguage(language, context)
    const content = await getPolicySourceContent('faq', normalizedLanguage)
    const entries = collectPolicyEntries(content, { source: 'faq' })
    const results = filterPolicyEntries(entries, question, limit)

    return JSON.stringify({
      found: results.length > 0,
      question: cleanString(question),
      language: normalizedLanguage,
      source: 'faq',
      sourceLabel: POLICY_SOURCE_META.faq.label,
      url: POLICY_SOURCE_META.faq.url,
      count: results.length,
      faqs: results,
      message: results.length > 0
        ? null
        : 'Chua tim thay FAQ phu hop voi cau hoi nay.'
    })
  } catch (err) {
    logger.error('[AI Tool] getFAQ error:', err.message)
    return JSON.stringify({ found: false, error: 'Loi khi lay FAQ.' })
  }
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

function getGuidePath(source, path) {
  return String(path || '')
    .split('.')
    .filter(Boolean)
    .reduce((result, key) => (result == null ? result : result[key]), source)
}

function getGuideLocalizedRoot(config = {}, language = 'vi') {
  return language === 'en' ? config.translations?.en || {} : {}
}

function getGuideText(config = {}, localizedRoot = {}, path, fallback = '') {
  return pickString(getGuidePath(localizedRoot, path), getGuidePath(config, path), fallback)
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

function escapeRegExp(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function isMongoObjectId(value) {
  return /^[0-9a-f]{24}$/i.test(String(value || '').trim())
}

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizePasswordResetEmail(value) {
  const email = cleanString(value).toLowerCase()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : ''
}

function normalizeEnum(value, allowedValues, fallback) {
  const normalized = cleanString(value)
  return allowedValues.includes(normalized) ? normalized : fallback
}

function normalizeOnlinePaymentMethod(value) {
  const normalized = normalizeIntentText(value)
  if (['card', 'the', 'atm', 'visa', 'mastercard', 'credit', 'debit'].includes(normalized)) {
    return 'vnpay'
  }

  return PLACE_ORDER_PAYMENT_METHODS.includes(normalized) ? normalized : 'vnpay'
}

async function createOnlinePaymentRequest(paymentMethod, orderId, userId, paymentReference = orderId) {
  if (paymentMethod === 'sepay') {
    return {
      method: paymentMethod,
      paymentReference
    }
  }

  const req = {
    headers: {},
    socket: { remoteAddress: '127.0.0.1' }
  }

  let result
  if (paymentMethod === 'vnpay') {
    result = await paymentService.createVNPayUrl({ orderId, userId, req })
  } else if (paymentMethod === 'momo') {
    result = await paymentService.createMoMoUrl({ orderId, userId })
  } else if (paymentMethod === 'zalopay') {
    result = await paymentService.createZaloPayUrl({ orderId, userId })
  } else {
    throw new Error('Phuong thuc thanh toan online khong hop le')
  }

  if (result?.statusCode >= 400 || !result?.body?.paymentUrl) {
    throw new Error(result?.body?.error || 'Khong tao duoc link thanh toan')
  }

  return {
    method: paymentMethod,
    paymentUrl: result.body.paymentUrl
  }
}

function normalizeIntentText(value = '') {
  return removeAccents(String(value || '').toLowerCase())
}

function getPromptIntentText(context = {}) {
  return normalizeIntentText(context.promptText || context.customerInfo?.promptText || '')
}

function hasExplicitCartAddIntent(context = {}) {
  const text = getPromptIntentText(context)
  return /(\bthem\b|\badd\b|cho vao|bo vao).{0,24}(gio|cart)/i.test(text)
    || /(gio|cart).{0,24}(\bthem\b|\badd\b|cho vao|bo vao)/i.test(text)
}

function isDirectPurchaseIntent(context = {}) {
  const text = getPromptIntentText(context)
  if (!text) return false

  return /\b(mua|dat|chot|checkout|order)\b/i.test(text)
    || /thanh toan/i.test(text)
}

function hasExplicitCartRemovalIntent(context = {}) {
  const text = getPromptIntentText(context)
  if (!text) return false

  return /\b(xoa|remove|delete|clear|loai|don)\b/i.test(text)
    || /\bbo\b.{0,24}(khoi|ra|gio|cart)/i.test(text)
    || /(khoi|ra|gio|cart).{0,24}\bbo\b/i.test(text)
}

function splitFullName(fullName = '') {
  const parts = cleanString(fullName).split(/\s+/).filter(Boolean)
  if (parts.length === 0) {
    return { firstName: '', lastName: '' }
  }

  if (parts.length === 1) {
    return { firstName: parts[0], lastName: parts[0] }
  }

  return {
    firstName: parts.slice(0, -1).join(' '),
    lastName: parts[parts.length - 1]
  }
}

function pickString(...values) {
  for (const value of values) {
    const normalized = cleanString(value)
    if (normalized) return normalized
  }

  return ''
}

function normalizePhone(value) {
  return cleanString(value).replace(/[\s\-.]/g, '')
}

function buildOrderContact({ contact = {}, user = null } = {}) {
  const sourceContact = contact && typeof contact === 'object' ? contact : {}
  const profile = user?.checkoutProfile || {}
  const fallbackName = splitFullName(user?.fullName)

  return {
    firstName: pickString(sourceContact.firstName, profile.firstName, fallbackName.firstName),
    lastName: pickString(sourceContact.lastName, profile.lastName, fallbackName.lastName),
    phone: normalizePhone(pickString(sourceContact.phone, profile.phone, user?.phone)),
    email: pickString(sourceContact.email, profile.email, user?.email),
    addressLine1: pickString(sourceContact.addressLine1, profile.addressLine1),
    provinceCode: pickString(sourceContact.provinceCode, profile.provinceCode),
    provinceName: pickString(sourceContact.provinceName, profile.provinceName),
    districtCode: pickString(sourceContact.districtCode, profile.districtCode),
    districtName: pickString(sourceContact.districtName, profile.districtName),
    wardCode: pickString(sourceContact.wardCode, profile.wardCode),
    wardName: pickString(sourceContact.wardName, profile.wardName),
    address: pickString(sourceContact.address, profile.address),
    notes: pickString(sourceContact.notes, profile.notes)
  }
}

function hasOwnProperty(object, field) {
  return Object.prototype.hasOwnProperty.call(object || {}, field)
}

function toPlainObject(value) {
  if (value && typeof value.toObject === 'function') return value.toObject()
  return value || {}
}

function serializeId(value) {
  if (!value) return ''
  return typeof value.toString === 'function' ? value.toString() : cleanString(value)
}

function serializeDate(value) {
  if (!value) return null
  if (value instanceof Date) return value.toISOString()
  return value
}

function buildUserProfileResponse(userValue = {}) {
  const user = toPlainObject(userValue)

  return {
    _id: serializeId(user._id || user.id),
    username: cleanString(user.username),
    fullName: cleanString(user.fullName),
    email: cleanString(user.email),
    phone: normalizePhone(user.phone),
    avatarUrl: cleanString(user.avatarUrl),
    status: cleanString(user.status),
    lastLogin: serializeDate(user.lastLogin),
    createdAt: serializeDate(user.createdAt),
    updatedAt: serializeDate(user.updatedAt)
  }
}

function normalizeUserProfileToolArgs(args = {}) {
  const source = args && typeof args === 'object' ? args : {}
  const nestedProfile = source.profile && typeof source.profile === 'object' ? source.profile : {}
  const payload = { ...nestedProfile }

  USER_PROFILE_MUTATION_FIELDS.forEach(field => {
    if (hasOwnProperty(source, field)) {
      payload[field] = source[field]
    }
  })

  return payload
}

function hasUserProfileMutationInput(payload = {}) {
  return USER_PROFILE_MUTATION_FIELDS.some(field => hasOwnProperty(payload, field))
}

function buildUserProfileUpdate(payload = {}) {
  const update = {}
  const invalidFields = []

  if (hasOwnProperty(payload, 'fullName')) {
    const fullName = cleanString(payload.fullName)
    if (!fullName) {
      invalidFields.push('fullName')
    } else {
      update.fullName = fullName
    }
  }

  if (hasOwnProperty(payload, 'phone')) {
    const phone = normalizePhone(payload.phone)
    if (phone && !/^[0-9]{9,15}$/.test(phone)) {
      invalidFields.push('phone')
    } else {
      update.phone = phone
    }
  }

  if (hasOwnProperty(payload, 'avatarUrl')) {
    update.avatarUrl = cleanString(payload.avatarUrl)
  }

  return { update, invalidFields }
}

function normalizeEmailChangeAddress(args = {}) {
  return cleanString(args.newEmail || args.email).toLowerCase()
}

function normalizeEmailChangeCode(args = {}) {
  return cleanString(args.code || args.otp)
}

function isValidEmailAddress(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanString(email))
}

function buildEmailChangeServiceResponse(result = {}, extra = {}) {
  const success = result.statusCode >= 200 && result.statusCode < 300

  return {
    success,
    ...extra,
    message: result.body?.message || (success
      ? 'Thao tac doi email thanh cong.'
      : 'Khong the thuc hien thao tac doi email luc nay.')
  }
}

function normalizeCheckoutDeliveryMethod(value) {
  return normalizeEnum(normalizeIntentText(value), CHECKOUT_PROFILE_DELIVERY_METHODS, 'pickup')
}

function normalizeCheckoutPaymentMethod(value) {
  const normalized = normalizeIntentText(value)

  if (['card', 'the', 'atm', 'visa', 'mastercard', 'credit', 'debit'].includes(normalized)) {
    return 'vnpay'
  }

  if (['bank', 'banking', 'chuyen khoan', 'chuyen-khoan'].includes(normalized)) {
    return 'transfer'
  }

  if (['lien he', 'thoa thuan'].includes(normalized)) {
    return 'contact'
  }

  return CHECKOUT_PROFILE_PAYMENT_METHODS.includes(normalized) ? normalized : 'transfer'
}

function normalizeCheckoutProfileForTool(profile = {}) {
  const normalizedAddress = normalizeStructuredAddress(profile || {})

  return {
    firstName: cleanString(profile?.firstName),
    lastName: cleanString(profile?.lastName),
    phone: normalizePhone(profile?.phone),
    email: cleanString(profile?.email),
    ...normalizedAddress,
    notes: cleanString(profile?.notes),
    deliveryMethod: normalizeCheckoutDeliveryMethod(profile?.deliveryMethod),
    paymentMethod: normalizeCheckoutPaymentMethod(profile?.paymentMethod)
  }
}

function normalizeCheckoutProfileToolArgs(args = {}) {
  const source = args && typeof args === 'object' ? args : {}
  const nestedProfile = source.profile && typeof source.profile === 'object' ? source.profile : {}
  const payload = { ...nestedProfile }

  CHECKOUT_PROFILE_MUTATION_FIELDS.forEach(field => {
    if (hasOwnProperty(source, field)) {
      payload[field] = source[field]
    }
  })

  return payload
}

function hasCheckoutProfileMutationInput(payload = {}) {
  return CHECKOUT_PROFILE_MUTATION_FIELDS.some(field => hasOwnProperty(payload, field))
}

function getCheckoutProfileValue(payload, currentProfile, field) {
  return hasOwnProperty(payload, field) ? payload[field] : currentProfile[field]
}

function buildCheckoutProfileUpdate(payload = {}, currentProfile = {}) {
  const current = normalizeCheckoutProfileForTool(currentProfile)
  const addressInput = CHECKOUT_PROFILE_ADDRESS_FIELDS.reduce((result, field) => ({
    ...result,
    [field]: getCheckoutProfileValue(payload, current, field)
  }), {})
  const normalizedAddress = normalizeStructuredAddress(addressInput)

  return {
    firstName: cleanString(getCheckoutProfileValue(payload, current, 'firstName')),
    lastName: cleanString(getCheckoutProfileValue(payload, current, 'lastName')),
    phone: normalizePhone(getCheckoutProfileValue(payload, current, 'phone')),
    email: cleanString(getCheckoutProfileValue(payload, current, 'email')),
    ...normalizedAddress,
    notes: cleanString(getCheckoutProfileValue(payload, current, 'notes')),
    deliveryMethod: normalizeCheckoutDeliveryMethod(getCheckoutProfileValue(payload, current, 'deliveryMethod')),
    paymentMethod: normalizeCheckoutPaymentMethod(getCheckoutProfileValue(payload, current, 'paymentMethod'))
  }
}

function getInvalidCheckoutProfileFields(profile = {}) {
  const invalidFields = []
  const phone = cleanString(profile.phone)
  const email = cleanString(profile.email)

  if (phone && !/^[0-9]{9,15}$/.test(phone)) {
    invalidFields.push('phone')
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    invalidFields.push('email')
  }

  return invalidFields
}

function hasCheckoutProfileData(profile = {}) {
  return [...CHECKOUT_PROFILE_STRING_FIELDS, ...CHECKOUT_PROFILE_ADDRESS_FIELDS]
    .some(field => Boolean(cleanString(profile[field])))
}

function buildCheckoutProfileResponse(userValue = {}) {
  const user = toPlainObject(userValue)
  const checkoutProfile = normalizeCheckoutProfileForTool(user.checkoutProfile || {})
  const contactPreview = buildOrderContact({ user: { ...user, checkoutProfile } })

  return {
    checkoutProfile,
    hasCheckoutProfile: hasCheckoutProfileData(checkoutProfile),
    contactPreview,
    missingContactFields: getMissingOrderContactFields(contactPreview),
    accountFallback: {
      fullName: cleanString(user.fullName),
      email: cleanString(user.email),
      phone: normalizePhone(user.phone)
    }
  }
}

function normalizePreferenceBoolean(value) {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number' && (value === 0 || value === 1)) return value === 1
  const normalized = normalizeIntentText(value)
  if (['true', '1', 'yes', 'y', 'on', 'enable', 'enabled', 'bat'].includes(normalized)) return true
  if (['false', '0', 'no', 'n', 'off', 'disable', 'disabled', 'tat'].includes(normalized)) return false
  return null
}

function normalizeNotificationPreferencesForTool(preferences = {}) {
  const channels = preferences?.channels || {}

  return {
    channels: {
      inApp: channels.inApp !== false,
      email: channels.email !== false,
      browser: channels.browser !== false,
      sms: channels.sms === true
    },
    orderUpdates: preferences.orderUpdates !== false,
    paymentUpdates: preferences.paymentUpdates !== false,
    promotions: preferences.promotions !== false,
    backInStock: preferences.backInStock !== false,
    wishlistUpdates: preferences.wishlistUpdates !== false,
    supportMessages: preferences.supportMessages !== false
  }
}

function normalizeNotificationPreferenceArgs(args = {}) {
  const source = args?.preferences && typeof args.preferences === 'object'
    ? { ...args.preferences, ...args }
    : args
  const channelSource = {
    ...(source?.channels && typeof source.channels === 'object' ? source.channels : {}),
    ...NOTIFICATION_CHANNEL_FIELDS.reduce((result, field) => {
      if (hasOwnProperty(source, field)) result[field] = source[field]
      return result
    }, {})
  }
  const payload = { channels: {} }

  NOTIFICATION_CHANNEL_FIELDS.forEach(field => {
    if (!hasOwnProperty(channelSource, field)) return
    const normalized = normalizePreferenceBoolean(channelSource[field])
    if (normalized !== null) payload.channels[field] = normalized
  })

  NOTIFICATION_TOPIC_FIELDS.forEach(field => {
    if (!hasOwnProperty(source, field)) return
    const normalized = normalizePreferenceBoolean(source[field])
    if (normalized !== null) payload[field] = normalized
  })

  return payload
}

function hasNotificationPreferencesMutationInput(payload = {}) {
  return NOTIFICATION_TOPIC_FIELDS.some(field => hasOwnProperty(payload, field))
    || NOTIFICATION_CHANNEL_FIELDS.some(field => hasOwnProperty(payload.channels, field))
}

function buildNotificationPreferencesUpdate(payload = {}, currentPreferences = {}) {
  const current = normalizeNotificationPreferencesForTool(currentPreferences)
  const channels = { ...current.channels }

  NOTIFICATION_CHANNEL_FIELDS.forEach(field => {
    if (hasOwnProperty(payload.channels, field)) channels[field] = payload.channels[field]
  })

  const nextPreferences = {
    ...current,
    channels
  }

  NOTIFICATION_TOPIC_FIELDS.forEach(field => {
    if (hasOwnProperty(payload, field)) nextPreferences[field] = payload[field]
  })

  return nextPreferences
}

function buildNotificationPreferencesResponse(userValue = {}) {
  const user = toPlainObject(userValue)

  return {
    notificationPreferences: normalizeNotificationPreferencesForTool(user.notificationPreferences || {})
  }
}

function getMissingOrderContactFields(contact = {}) {
  return ['firstName', 'lastName', 'phone'].filter(field => !cleanString(contact[field]))
}

function getInvalidOrderContactFields(contact = {}) {
  const invalidFields = []
  const phone = cleanString(contact.phone)
  const email = cleanString(contact.email)

  if (phone && !/^[0-9]{9,15}$/.test(phone)) {
    invalidFields.push('phone')
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    invalidFields.push('email')
  }

  return invalidFields
}

function normalizePlaceOrderItems({ items, productId, productQuery, quantity } = {}) {
  const rawItems = Array.isArray(items) && items.length > 0
    ? items
    : [{ productId, productQuery, quantity }]

  return rawItems
    .map(item => ({
      productId: cleanString(item?.productId),
      productQuery: cleanString(item?.productQuery),
      quantity: normalizeQuantity(item?.quantity, 1)
    }))
    .filter(item => (item.productId || item.productQuery) && item.quantity > 0)
}

function buildOrderItemFromProduct(product, quantity) {
  const unitPrice = calculateEffectiveProductPrice(product)

  return {
    productId: product._id.toString(),
    name: product.title,
    image: product.thumbnail,
    quantity,
    price: unitPrice,
    salePrice: unitPrice,
    isFlashSale: false,
    discountPercentage: product.discountPercentage || 0,
    slug: product.slug
  }
}

function buildOrderItemFromCartItem(item = {}) {
  return {
    productId: item.productId,
    name: item.name,
    image: item.image,
    quantity: item.quantity,
    price: item.unitPrice,
    salePrice: item.unitPrice,
    isFlashSale: item.isFlashSale,
    flashSaleId: item.flashSaleId || undefined,
    discountPercentage: item.discountPercentage,
    slug: item.slug
  }
}

async function buildDirectOrderItems(requestedItems = []) {
  if (!requestedItems.length) {
    return {
      error: {
        success: false,
        message: 'Chua co san pham cu the de dat hang.'
      }
    }
  }

  const groupedItems = new Map()

  for (const item of requestedItems) {
    const product = await resolveProductForCartInput(item)
    if (!isSellableProduct(product)) {
      return {
        error: {
          success: false,
          message: `Khong tim thay san pham "${item.productQuery || item.productId || ''}" de dat hang.`
        }
      }
    }

    const productId = product._id.toString()
    const existing = groupedItems.get(productId)
    groupedItems.set(productId, {
      product,
      quantity: (existing?.quantity || 0) + item.quantity
    })
  }

  const orderItems = []
  for (const { product, quantity } of groupedItems.values()) {
    const stock = Number(product.stock || 0)
    if (stock <= 0) {
      return {
        error: {
          success: false,
          message: `${product.title} hien da het hang.`,
          stock
        }
      }
    }

    if (quantity > stock) {
      return {
        error: {
          success: false,
          message: `So luong yeu cau vuot ton kho hien co cua ${product.title}.`,
          stock
        }
      }
    }

    orderItems.push(buildOrderItemFromProduct(product, quantity))
  }

  return { orderItems }
}

async function buildCartOrderItems(userId, { promoCode } = {}) {
  const cart = await buildCartSnapshot(userId, { promoCode })
  if (cart.distinctItemCount === 0) {
    return {
      error: {
        success: false,
        message: 'Gio hang hien dang trong, chua co san pham de dat hang.'
      }
    }
  }

  if (cart.hasIssues) {
    return {
      error: {
        success: false,
        requiresCartFix: true,
        message: 'Gio hang hien co van de can xu ly truoc khi dat hang.',
        cart
      }
    }
  }

  return {
    cart,
    orderItems: cart.items.map(buildOrderItemFromCartItem)
  }
}

function calculateOrderItemsSubtotal(orderItems = []) {
  return orderItems.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0)
}

function normalizeShipping(shipping, subtotal) {
  const normalized = Number(shipping)
  if (Number.isFinite(normalized) && normalized >= 0) {
    return normalized
  }

  return Number(subtotal || 0) > FREE_SHIPPING_THRESHOLD ? 0 : DEFAULT_SHIPPING_FEE
}

function normalizeDeliverySubtotal(value) {
  if (value === undefined || value === null || value === '') return null
  const normalized = Number(value)
  return Number.isFinite(normalized) && normalized >= 0 ? normalized : null
}

function normalizeDeliveryEstimateDays(value) {
  if (value === undefined || value === null || value === '') return null
  const normalized = Number(value)
  if (!Number.isFinite(normalized) || normalized < 0) return null
  return Math.floor(normalized)
}

function formatDeliveryEtaLabel(days, deliveryType = 'manual') {
  if (deliveryType === 'instant_account') return 'Nhan ngay sau khi thanh toan/xac nhan.'
  if (days == null) return 'Lien he de xac nhan ETA.'
  if (days <= 0) return 'Trong ngay.'
  return days === 1 ? 'Du kien trong 1 ngay.' : `Du kien trong ${days} ngay.`
}

function buildDeliveryItemPayload(product, quantity = 1, { lineSubtotal = null, issues = [] } = {}) {
  const normalizedQuantity = normalizeQuantity(quantity, 1) || 1
  const stock = Number(product?.stock || 0)
  const deliveryType = cleanString(product?.deliveryType) || 'manual'
  const deliveryEstimateDays = normalizeDeliveryEstimateDays(product?.deliveryEstimateDays)
  const unitPrice = calculateEffectiveProductPrice(product)
  const normalizedLineSubtotal = normalizeDeliverySubtotal(lineSubtotal)
  const itemIssues = [...issues]
  const sellable = isSellableProduct(product)

  if (!sellable) {
    itemIssues.push({
      code: 'unavailable',
      message: 'San pham khong con ban tren he thong.'
    })
  } else {
    if (stock <= 0) {
      itemIssues.push({
        code: 'out_of_stock',
        message: 'San pham hien da het hang.'
      })
    }

    if (normalizedQuantity > stock) {
      itemIssues.push({
        code: 'quantity_exceeds_stock',
        message: `So luong yeu cau (${normalizedQuantity}) vuot ton kho hien co (${stock}).`
      })
    }
  }

  return {
    productId: product?._id?.toString() || null,
    slug: product?.slug || null,
    name: product?.title || 'San pham khong xac dinh',
    quantity: normalizedQuantity,
    stock,
    available: sellable && stock > 0 && normalizedQuantity <= stock,
    deliveryType,
    deliveryEstimateDays,
    deliveryEta: formatDeliveryEtaLabel(deliveryEstimateDays, deliveryType),
    deliveryInstructions: cleanString(product?.deliveryInstructions) || null,
    unitPrice,
    unitPriceFormatted: formatPrice(unitPrice),
    lineSubtotal: normalizedLineSubtotal != null ? normalizedLineSubtotal : unitPrice * normalizedQuantity,
    lineSubtotalFormatted: formatPrice(normalizedLineSubtotal != null ? normalizedLineSubtotal : unitPrice * normalizedQuantity),
    issues: itemIssues
  }
}

async function buildDeliveryItemsFromProductInputs(requestedItems = []) {
  const result = {
    items: [],
    missingItems: []
  }

  for (const item of requestedItems) {
    const product = await resolveProductForCartInput(item)
    if (!product) {
      result.missingItems.push({
        productId: item.productId || null,
        productQuery: item.productQuery || null,
        quantity: item.quantity,
        message: `Khong tim thay san pham "${item.productQuery || item.productId || ''}" de xem ETA.`
      })
      continue
    }

    result.items.push(buildDeliveryItemPayload(product, item.quantity))
  }

  return result
}

async function buildDeliveryItemsFromCart(cart = {}) {
  if (!Array.isArray(cart.items) || cart.items.length === 0) return []

  const productIds = cart.items.map(item => item.productId).filter(Boolean)
  const products = await productRepository.findByQuery(
    { _id: { $in: productIds } },
    {
      select: 'title price discountPercentage stock thumbnail slug status deleted deliveryEstimateDays deliveryType deliveryInstructions',
      lean: true
    }
  )
  const productMap = new Map(products.map(product => [product._id.toString(), product]))

  return cart.items.map(item => {
    const product = productMap.get(item.productId) || null
    if (!product) {
      return {
        productId: item.productId,
        slug: item.slug || null,
        name: item.name || 'San pham khong xac dinh',
        quantity: item.quantity,
        stock: 0,
        available: false,
        deliveryType: null,
        deliveryEstimateDays: null,
        deliveryEta: 'Khong xac dinh.',
        deliveryInstructions: null,
        unitPrice: item.unitPrice,
        unitPriceFormatted: item.unitPriceFormatted,
        lineSubtotal: item.lineTotal,
        lineSubtotalFormatted: item.lineTotalFormatted,
        issues: [
          ...(Array.isArray(item.issues) ? item.issues : []),
          {
            code: 'unavailable',
            message: 'San pham khong con ban tren he thong.'
          }
        ]
      }
    }

    return buildDeliveryItemPayload(product, item.quantity, {
      lineSubtotal: item.lineTotal,
      issues: Array.isArray(item.issues) ? item.issues : []
    })
  })
}

function calculateDeliveryItemsSubtotal(items = []) {
  return items.reduce((sum, item) => sum + Number(item.lineSubtotal || 0), 0)
}

function buildDeliveryEtaSummary(items = []) {
  const availableItems = items.filter(item => item.available)
  if (items.length === 0 || availableItems.length === 0) {
    return {
      type: 'default',
      label: 'Trong ngay voi pickup; tuy thoa thuan voi lien he.',
      minDays: 0,
      maxDays: 0,
      hasProductContext: items.length > 0,
      hasUnknownEta: false,
      hasInstantItems: false,
      hasManualItems: false
    }
  }

  const hasInstantItems = availableItems.some(item => item.deliveryType === 'instant_account')
  const hasManualItems = availableItems.some(item => item.deliveryType !== 'instant_account')
  const manualItems = availableItems.filter(item => item.deliveryType !== 'instant_account')
  const manualDays = manualItems
    .map(item => item.deliveryEstimateDays)
    .filter(days => Number.isFinite(days))
  const hasUnknownEta = manualItems.some(item => item.deliveryEstimateDays == null)
  const maxDays = manualDays.length > 0 ? Math.max(...manualDays) : 0

  if (!hasManualItems) {
    return {
      type: 'instant',
      label: 'Nhan ngay sau khi thanh toan/xac nhan.',
      minDays: 0,
      maxDays: 0,
      hasProductContext: true,
      hasUnknownEta: false,
      hasInstantItems,
      hasManualItems
    }
  }

  return {
    type: hasUnknownEta && maxDays === 0 ? 'contact_required' : 'estimated',
    label: hasUnknownEta && maxDays === 0
      ? 'Lien he de xac nhan ETA.'
      : formatDeliveryEtaLabel(maxDays, 'manual'),
    minDays: 0,
    maxDays: hasUnknownEta && maxDays === 0 ? null : maxDays,
    hasProductContext: true,
    hasUnknownEta,
    hasInstantItems,
    hasManualItems
  }
}

function buildDeliveryAvailability(items = []) {
  const unavailableItems = items
    .filter(item => !item.available)
    .map(item => ({
      productId: item.productId,
      name: item.name,
      quantity: item.quantity,
      stock: item.stock,
      issues: item.issues
    }))

  return {
    deliveryAvailable: unavailableItems.length === 0,
    unavailableItems
  }
}

function buildDeliveryMethodOptions({ eta, availability }) {
  const deliveryAvailable = availability.deliveryAvailable

  return [
    {
      id: 'pickup',
      name: 'Nhan hang/ban giao truc tiep',
      available: deliveryAvailable,
      eta: eta.label,
      etaDetails: eta,
      fee: 0,
      feeFormatted: formatPrice(0),
      description: 'Nhan tai cua hang hoac ban giao truc tiep theo thong tin don hang.'
    },
    {
      id: 'contact',
      name: 'Lien he de thoa thuan',
      available: deliveryAvailable,
      eta: 'Tuy thoa thuan.',
      etaDetails: {
        type: 'agreement',
        label: 'Tuy thoa thuan.',
        minDays: null,
        maxDays: null,
        referenceEta: eta
      },
      fee: 0,
      feeFormatted: formatPrice(0),
      description: 'Nhan/giao theo lich va phi thoa thuan voi nhan vien neu phat sinh.'
    }
  ]
}

function buildDeliveryShippingEstimate(subtotal) {
  if (subtotal == null) {
    return {
      available: false,
      requiresSubtotal: true,
      subtotal: null,
      subtotalFormatted: null,
      fee: null,
      feeFormatted: null,
      isFree: null,
      freeShippingThreshold: FREE_SHIPPING_THRESHOLD,
      freeShippingThresholdFormatted: formatPrice(FREE_SHIPPING_THRESHOLD),
      defaultFee: DEFAULT_SHIPPING_FEE,
      defaultFeeFormatted: formatPrice(DEFAULT_SHIPPING_FEE),
      rule: `Mien phi neu tam tinh don hang > ${formatPrice(FREE_SHIPPING_THRESHOLD)}, nguoc lai ${formatPrice(DEFAULT_SHIPPING_FEE)}.`
    }
  }

  const fee = normalizeShipping(null, subtotal)

  return {
    available: true,
    requiresSubtotal: false,
    subtotal,
    subtotalFormatted: formatPrice(subtotal),
    fee,
    feeFormatted: formatPrice(fee),
    isFree: fee === 0,
    freeShippingThreshold: FREE_SHIPPING_THRESHOLD,
    freeShippingThresholdFormatted: formatPrice(FREE_SHIPPING_THRESHOLD),
    defaultFee: DEFAULT_SHIPPING_FEE,
    defaultFeeFormatted: formatPrice(DEFAULT_SHIPPING_FEE),
    rule: `Mien phi neu tam tinh don hang > ${formatPrice(FREE_SHIPPING_THRESHOLD)}, nguoc lai ${formatPrice(DEFAULT_SHIPPING_FEE)}.`,
    source: 'checkout_default'
  }
}

function buildDeliveryOptionsMessage({ source, deliveryItems, missingItems, availability }) {
  if (missingItems.length > 0 && deliveryItems.length === 0) {
    return 'Khong tim thay san pham can xem ETA; da tra ve phuong thuc nhan hang/giao hang chung.'
  }

  if (!availability.deliveryAvailable) {
    return 'Da lay phuong thuc nhan hang/giao hang, nhung co san pham chua san sang de giao/nhan.'
  }

  if (source === 'current_cart') {
    return 'Da lay phuong thuc nhan hang/giao hang kha dung theo gio hang hien tai.'
  }

  if (source === 'product_input') {
    return 'Da lay phuong thuc nhan hang/giao hang kha dung theo san pham.'
  }

  return 'Da lay phuong thuc nhan hang/giao hang kha dung.'
}

async function clearUserCart(userId) {
  const cart = await cartRepository.findByUserId(userId)
  if (!cart) return

  cart.items = []
  cart.promoCode = ''
  cart.updatedAt = new Date()
  await cartRepository.save(cart)
}

async function removeOrderedItemsFromCart(userId, orderItems = []) {
  const orderedQuantityByProductId = new Map()
  for (const item of orderItems) {
    const productId = String(item?.productId || '').trim()
    if (!productId) continue
    orderedQuantityByProductId.set(
      productId,
      (orderedQuantityByProductId.get(productId) || 0) + Number(item.quantity || 0)
    )
  }

  if (orderedQuantityByProductId.size === 0) return

  const cart = await cartRepository.findByUserId(userId)
  if (!cart || !Array.isArray(cart.items) || cart.items.length === 0) return

  cart.items = cart.items.reduce((nextItems, item) => {
    const productId = item.productId.toString()
    const orderedQuantity = orderedQuantityByProductId.get(productId) || 0
    if (!orderedQuantity) {
      nextItems.push(item)
      return nextItems
    }

    const remainingQuantity = Number(item.quantity || 0) - orderedQuantity
    if (remainingQuantity > 0) {
      item.quantity = remainingQuantity
      nextItems.push(item)
    }

    return nextItems
  }, [])
  if (cart.items.length === 0) {
    cart.promoCode = ''
  }
  cart.updatedAt = new Date()
  await cartRepository.save(cart)
}

function formatOrderCode(order) {
  order = order || {}
  const orderCode = cleanString(order.orderCode)
  if (orderCode) return orderCode.startsWith('#') ? orderCode : `#${orderCode}`

  const id = order?._id?.toString() || ''
  return id ? `#${id.slice(-8).toUpperCase()}` : ''
}

function buildOrderPayload(order = {}) {
  order = order || {}
  const id = order._id?.toString() || null
  const orderCode = cleanString(order.orderCode) || null

  return {
    id,
    orderCode,
    code: formatOrderCode(order),
    status: order.status,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    deliveryMethod: order.deliveryMethod,
    subtotal: order.subtotal,
    subtotalFormatted: formatPrice(order.subtotal),
    discount: order.discount,
    discountFormatted: formatPrice(order.discount),
    shipping: order.shipping,
    shippingFormatted: formatPrice(order.shipping),
    total: order.total,
    totalFormatted: formatPrice(order.total),
    itemCount: Array.isArray(order.orderItems)
      ? order.orderItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0)
      : 0,
    orderUrl: id ? `${CLIENT_URL}/orders/${id}` : null,
    createdAt: order.createdAt || null
  }
}

function getOrderDocumentUrl(source = {}, type) {
  const document = source[type] && typeof source[type] === 'object' ? source[type] : {}

  return pickString(
    source[type],
    source[`${type}Url`],
    source[`${type}Link`],
    source[`${type}PdfUrl`],
    document.url,
    document.link,
    document.pdfUrl,
    document.downloadUrl
  )
}

function buildOrderInvoicePayload(order = {}) {
  const source = toPlainObject(order) || {}
  const orderSummary = buildOrderPayload(source)
  const invoiceUrl = getOrderDocumentUrl(source, 'invoice')
    || pickString(source.taxInvoiceUrl, source.vatInvoiceUrl)
  const receiptUrl = getOrderDocumentUrl(source, 'receipt')
    || pickString(source.paymentReceiptUrl)
  const orderDetailUrl = orderSummary.orderUrl
  const successUrl = orderSummary.id
    ? `${CLIENT_URL}/order-success?orderId=${orderSummary.id}${source.paymentMethod ? `&method=${source.paymentMethod}` : ''}`
    : null
  const instructions = []

  if (invoiceUrl) {
    instructions.push('Mo invoiceUrl de xem hoac tai hoa don cua don hang.')
  }

  if (receiptUrl) {
    instructions.push('Mo receiptUrl de xem hoac tai bien nhan thanh toan cua don hang.')
  }

  if (orderDetailUrl) {
    instructions.push('Neu chua co file hoa don rieng, mo orderDetailUrl de xem chi tiet don hang va dung chuc nang in/luu PDF cua trinh duyet lam bien nhan.')
  }

  if (source.paymentStatus && source.paymentStatus !== 'paid') {
    instructions.push('Don hang chua duoc ghi nhan da thanh toan; hoa don/bien nhan thanh toan co the chua kha dung.')
  }

  instructions.push('Neu can hoa don VAT hoac chung tu do cua hang phat hanh rieng, hay lien he nhan vien ho tro kem ma don hang.')

  return {
    found: true,
    invoiceAvailable: !!invoiceUrl,
    receiptAvailable: !!receiptUrl || !!orderDetailUrl,
    hasGeneratedInvoice: !!invoiceUrl,
    hasGeneratedReceipt: !!receiptUrl,
    message: invoiceUrl
      ? 'Da tim thay link hoa don cua don hang.'
      : 'Hien tai he thong chua co file hoa don rieng cho don nay. Co the dung trang chi tiet don hang lam bien nhan va in/luu PDF neu can.',
    order: orderSummary,
    links: {
      invoiceUrl: invoiceUrl || null,
      receiptUrl: receiptUrl || null,
      orderDetailUrl,
      orderSuccessUrl: successUrl
    },
    instructions
  }
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

function excerptText(text, maxLength = 180) {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim()
  if (!normalized) return ''
  if (normalized.length <= maxLength) return normalized
  return `${normalized.slice(0, maxLength - 1).trim()}…`
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

function getProductObject(product = {}) {
  return product && typeof product.toObject === 'function' ? product.toObject() : product
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

function formatDate(value) {
  if (!value) return null
  return new Date(value).toLocaleDateString('vi-VN')
}

function formatPrice(amount) {
  if (amount == null) return '0₫'
  return new Intl.NumberFormat('vi-VN').format(amount) + '₫'
}

// ─── Tool Registry (map name → executor function) ───────────────────────────

const ORDER_STATUS_LABELS = {
  pending: 'Cho xac nhan',
  confirmed: 'Da xac nhan',
  shipping: 'Dang giao hang',
  completed: 'Hoan thanh',
  cancelled: 'Da huy'
}

const PAYMENT_STATUS_LABELS = {
  pending: 'Chua thanh toan',
  paid: 'Da thanh toan',
  failed: 'Thanh toan that bai'
}

const PAYMENT_METHOD_LABELS = {
  transfer: 'Chuyen khoan',
  contact: 'Lien he thoa thuan',
  vnpay: 'VNPay',
  momo: 'MoMo',
  zalopay: 'ZaloPay',
  sepay: 'Sepay'
}

function getOrderObject(order = {}) {
  return typeof order?.toObject === 'function' ? order.toObject() : (order || {})
}

function normalizeOrderLookupValue({ orderId, orderCode } = {}) {
  return cleanString(orderId || orderCode).replace(/^#/, '')
}

function getOrderComparableCodes(order = {}) {
  const source = getOrderObject(order)
  const id = source._id?.toString?.() || String(source._id || '')
  const orderCode = cleanString(source.orderCode).replace(/^#/, '')
  const displayCode = formatOrderCode(source).replace(/^#/, '')

  return [id, orderCode, displayCode]
    .filter(Boolean)
    .map(value => value.toLowerCase())
}

function orderMatchesLookup(order, lookup) {
  const normalizedLookup = cleanString(lookup).replace(/^#/, '').toLowerCase()
  if (!normalizedLookup) return false

  const codes = getOrderComparableCodes(order)
  if (codes.includes(normalizedLookup)) return true

  return normalizedLookup.length >= 4 && codes.some(code => code.endsWith(normalizedLookup))
}

async function resolveOwnOrderId(userId, lookup = {}) {
  const value = normalizeOrderLookupValue(lookup)
  if (!value) {
    return {
      error: {
        found: false,
        message: 'Vui long cung cap ma don hang can thao tac.'
      }
    }
  }

  if (isMongoObjectId(value)) {
    return { orderId: value }
  }

  const result = await ordersService.getMyOrders(userId)
  const orders = Array.isArray(result?.orders) ? result.orders : []
  const matches = orders.filter(order => orderMatchesLookup(order, value))

  if (matches.length === 0) {
    return {
      error: {
        found: false,
        message: `Khong tim thay don hang "${value}" trong tai khoan dang chat.`
      }
    }
  }

  if (matches.length > 1) {
    return {
      error: {
        found: false,
        ambiguous: true,
        message: 'Tim thay nhieu don co ma gan giong nhau. Vui long cung cap ma don day du hon.',
        orders: matches.slice(0, 5).map(order => buildOrderPayload(order))
      }
    }
  }

  return { orderId: matches[0]._id.toString() }
}

function buildOrderItemPayload(item = {}) {
  const quantity = Number(item.quantity || 0)
  const unitPrice = Number(item.price ?? item.salePrice ?? 0)

  return {
    productId: item.productId?.toString?.() || String(item.productId || ''),
    name: item.name || 'San pham',
    quantity,
    unitPrice,
    unitPriceFormatted: formatPrice(unitPrice),
    lineTotal: unitPrice * quantity,
    lineTotalFormatted: formatPrice(unitPrice * quantity),
    deliveryType: item.deliveryType || 'manual'
  }
}

function buildOrderSummaryPayload(order = {}) {
  const source = getOrderObject(order)
  const items = Array.isArray(source.orderItems) ? source.orderItems : []

  return {
    ...buildOrderPayload(source),
    statusLabel: ORDER_STATUS_LABELS[source.status] || source.status,
    paymentStatusLabel: PAYMENT_STATUS_LABELS[source.paymentStatus] || source.paymentStatus,
    canCancel: source.status === 'pending',
    itemsPreview: items.slice(0, 3).map(buildOrderItemPayload)
  }
}

function buildOrderDetailPayload(order = {}) {
  const source = getOrderObject(order)
  const items = Array.isArray(source.orderItems) ? source.orderItems : []

  return {
    ...buildOrderSummaryPayload(source),
    items: items.map(buildOrderItemPayload),
    contact: {
      name: [source.contact?.firstName, source.contact?.lastName].filter(Boolean).join(' ').trim(),
      phone: source.contact?.phone || '',
      email: source.contact?.email || '',
      address: source.contact?.address || source.contact?.addressLine1 || '',
      notes: source.contact?.notes || ''
    },
    cancelledAt: source.cancelledAt || null,
    updatedAt: source.updatedAt || null
  }
}

async function listMyOrders({ status, limit = 5 } = {}, context = {}) {
  try {
    const userId = normalizeUserId(context)
    if (!isMongoObjectId(userId)) {
      return JSON.stringify({
        found: false,
        requiresLogin: true,
        message: 'Khach can dang nhap de xem lich su don hang.'
      })
    }

    const normalizedStatus = cleanString(status)
    const normalizedLimit = Math.min(Math.max(Number(limit) || 5, 1), 10)
    const result = await ordersService.getMyOrders(userId)
    const allOrders = Array.isArray(result?.orders) ? result.orders : []
    const filteredOrders = normalizedStatus
      ? allOrders.filter(order => order.status === normalizedStatus)
      : allOrders
    const orders = filteredOrders.slice(0, normalizedLimit)

    return JSON.stringify({
      found: orders.length > 0,
      count: orders.length,
      totalCount: filteredOrders.length,
      message: orders.length > 0 ? null : 'Khong tim thay don hang phu hop voi yeu cau.',
      orders: orders.map(order => buildOrderSummaryPayload(order))
    })
  } catch (err) {
    logger.error('[AI Tool] listMyOrders error:', err.message)
    return JSON.stringify({ found: false, error: 'Loi khi lay danh sach don hang.' })
  }
}

async function getOrderDetail({ orderId, orderCode } = {}, context = {}) {
  try {
    const userId = normalizeUserId(context)
    if (!isMongoObjectId(userId)) {
      return JSON.stringify({
        found: false,
        requiresLogin: true,
        message: 'Khach can dang nhap de xem chi tiet don hang.'
      })
    }

    const resolved = await resolveOwnOrderId(userId, { orderId, orderCode })
    if (resolved.error) return JSON.stringify(resolved.error)

    const result = await ordersService.getOrderDetail(userId, resolved.orderId)
    return JSON.stringify({
      found: true,
      order: buildOrderDetailPayload(result.order)
    })
  } catch (err) {
    logger.error('[AI Tool] getOrderDetail error:', err.message)
    return JSON.stringify({
      found: false,
      message: err.message || 'Khong tim thay don hang.',
      error: 'Loi khi lay chi tiet don hang.'
    })
  }
}

async function getOrderInvoice({ orderId, orderCode } = {}, context = {}) {
  try {
    const userId = normalizeUserId(context)
    if (!isMongoObjectId(userId)) {
      return JSON.stringify({
        found: false,
        requiresLogin: true,
        message: 'Khach can dang nhap de lay link hoa don hoac bien nhan cua don hang.'
      })
    }

    const resolved = await resolveOwnOrderId(userId, { orderId, orderCode })
    if (resolved.error) return JSON.stringify({ found: false, ...resolved.error })

    const result = await ordersService.getOrderDetail(userId, resolved.orderId)
    return JSON.stringify(buildOrderInvoicePayload(result.order))
  } catch (err) {
    logger.error('[AI Tool] getOrderInvoice error:', err.message)
    return JSON.stringify({
      found: false,
      message: err.message || 'Khong the lay thong tin hoa don hoac bien nhan cua don hang.',
      error: 'Loi khi lay hoa don/bien nhan don hang.'
    })
  }
}

function buildReorderItemsFromOrder(order = {}) {
  const source = getOrderObject(order)
  const items = Array.isArray(source.orderItems) ? source.orderItems : []

  return items
    .map(item => ({
      productId: serializeId(item.productId),
      quantity: normalizeQuantity(item.quantity, 1)
    }))
    .filter(item => item.productId && item.quantity > 0)
}

function normalizeReorderPaymentMethod(paymentMethod, sourcePaymentMethod) {
  const requestedPaymentMethod = cleanString(paymentMethod).toLowerCase()
  if (requestedPaymentMethod) {
    return requestedPaymentMethod === 'card' || PLACE_ORDER_PAYMENT_METHODS.includes(requestedPaymentMethod)
      ? requestedPaymentMethod
      : undefined
  }

  const previousPaymentMethod = cleanString(sourcePaymentMethod).toLowerCase()
  return PLACE_ORDER_PAYMENT_METHODS.includes(previousPaymentMethod)
    ? previousPaymentMethod
    : undefined
}

function buildReorderSelectionPayload(orders = []) {
  const recentOrders = orders.slice(0, 5)

  return {
    success: false,
    requiresOrderSelection: true,
    found: recentOrders.length > 0,
    message: recentOrders.length > 0
      ? 'Vui long chon ma don hang cu can dat lai.'
      : 'Tai khoan dang chat chua co don hang nao de dat lai.',
    orders: recentOrders.map(order => buildOrderSummaryPayload(order))
  }
}

async function reorderPreviousOrder({
  orderId,
  orderCode,
  paymentMethod,
  deliveryMethod,
  promoCode,
  shipping
} = {}, context = {}) {
  try {
    const userId = normalizeUserId(context)
    if (!isMongoObjectId(userId)) {
      return JSON.stringify({
        success: false,
        requiresLogin: true,
        message: 'Khach can dang nhap de dat lai don hang cu.'
      })
    }

    if (!cleanString(orderId || orderCode)) {
      const result = await ordersService.getMyOrders(userId)
      return JSON.stringify(buildReorderSelectionPayload(Array.isArray(result?.orders) ? result.orders : []))
    }

    const resolved = await resolveOwnOrderId(userId, { orderId, orderCode })
    if (resolved.error) return JSON.stringify({ success: false, ...resolved.error })

    const previousOrderResult = await ordersService.getOrderDetail(userId, resolved.orderId)
    const previousOrder = getOrderObject(previousOrderResult.order)
    const reorderItems = buildReorderItemsFromOrder(previousOrder)

    if (reorderItems.length === 0) {
      return JSON.stringify({
        success: false,
        message: `Don ${formatOrderCode(previousOrder)} khong co san pham hop le de dat lai.`,
        sourceOrder: buildOrderPayload(previousOrder)
      })
    }

    const nextDeliveryMethod = normalizeEnum(
      deliveryMethod || previousOrder.deliveryMethod,
      PLACE_ORDER_DELIVERY_METHODS,
      'pickup'
    )
    const nextPaymentMethod = normalizeReorderPaymentMethod(paymentMethod, previousOrder.paymentMethod)
    const nextShipping = Number(shipping)
    const placeOrderArgs = {
      contact: toPlainObject(previousOrder.contact),
      items: reorderItems,
      deliveryMethod: nextDeliveryMethod,
      paymentMethod: nextPaymentMethod,
      promoCode: cleanString(promoCode)
    }

    if (Number.isFinite(nextShipping) && nextShipping >= 0) {
      placeOrderArgs.shipping = nextShipping
    }

    const result = parseToolPayload(await placeOrder(placeOrderArgs, context)) || {}
    const sourceOrder = buildOrderPayload(previousOrder)

    if (!result.success) {
      return JSON.stringify({
        ...result,
        success: false,
        reorder: true,
        sourceOrder,
        message: result.message || `Khong the dat lai don ${sourceOrder.code}.`
      })
    }

    return JSON.stringify({
      ...result,
      reorder: true,
      sourceOrder,
      reorderedItemCount: reorderItems.reduce((sum, item) => sum + item.quantity, 0),
      message: `Da tao don dat lai tu ${sourceOrder.code}. ${result.message || ''}`.trim()
    })
  } catch (err) {
    logger.error('[AI Tool] reorderPreviousOrder error:', err.message)
    return JSON.stringify({
      success: false,
      message: err.message || 'Khong the dat lai don hang cu.',
      error: 'Loi khi dat lai don hang cu.'
    })
  }
}

async function trackOrderByCode({ orderCode, phone } = {}) {
  try {
    const result = await ordersService.trackOrder({ orderCode, phone })
    const order = result?.order || {}
    const orderId = order.id?.toString?.() || String(order.id || '')

    return JSON.stringify({
      found: true,
      order: {
        ...order,
        id: orderId || null,
        code: order.orderCode || (orderId ? `#${orderId.slice(-8).toUpperCase()}` : null),
        totalFormatted: formatPrice(order.total),
        orderUrl: orderId ? `${CLIENT_URL}/orders/${orderId}` : null
      }
    })
  } catch (err) {
    logger.error('[AI Tool] trackOrderByCode error:', err.message)
    return JSON.stringify({
      found: false,
      message: err.message || 'Khong tim thay don hang hoac so dien thoai khong khop.'
    })
  }
}

async function cancelOrder({ orderId, orderCode } = {}, context = {}) {
  try {
    const userId = normalizeUserId(context)
    if (!isMongoObjectId(userId)) {
      return JSON.stringify({
        success: false,
        requiresLogin: true,
        message: 'Khach can dang nhap de huy don hang.'
      })
    }

    const resolved = await resolveOwnOrderId(userId, { orderId, orderCode })
    if (resolved.error) return JSON.stringify({ success: false, ...resolved.error })

    const result = await ordersService.cancelOrder(userId, resolved.orderId)
    return JSON.stringify({
      success: true,
      message: 'Da huy don hang thanh cong.',
      order: buildOrderPayload(result.order)
    })
  } catch (err) {
    logger.error('[AI Tool] cancelOrder error:', err.message)
    return JSON.stringify({
      success: false,
      message: err.message || 'Khong the huy don hang.',
      error: 'Loi khi huy don hang.'
    })
  }
}

function buildOrderAddressPatch(args = {}) {
  return ORDER_ADDRESS_FIELDS.reduce((patch, field) => {
    if (Object.prototype.hasOwnProperty.call(args, field)) {
      patch[field] = args[field]
    }

    return patch
  }, {})
}

async function updateOrderAddress(args = {}, context = {}) {
  try {
    const userId = normalizeUserId(context)
    if (!isMongoObjectId(userId)) {
      return JSON.stringify({
        success: false,
        requiresLogin: true,
        message: 'Khach can dang nhap de sua dia chi giao hang cua don hang.'
      })
    }

    const resolved = await resolveOwnOrderId(userId, {
      orderId: args.orderId,
      orderCode: args.orderCode
    })
    if (resolved.error) return JSON.stringify({ success: false, ...resolved.error })

    const result = await ordersService.updateOrderAddress(
      userId,
      resolved.orderId,
      buildOrderAddressPatch(args)
    )

    return JSON.stringify({
      success: true,
      message: 'Da cap nhat dia chi giao hang cua don hang.',
      order: buildOrderDetailPayload(result.order)
    })
  } catch (err) {
    logger.error('[AI Tool] updateOrderAddress error:', err.message)
    return JSON.stringify({
      success: false,
      message: err.message || 'Khong the cap nhat dia chi giao hang cua don hang.',
      error: 'Loi khi cap nhat dia chi don hang.'
    })
  }
}

function buildOrderContactPatch(args = {}) {
  const patch = {}

  if (Object.prototype.hasOwnProperty.call(args, 'phone')) {
    patch.phone = args.phone
  }
  if (Object.prototype.hasOwnProperty.call(args, 'email')) {
    patch.email = args.email
  }
  if (Object.prototype.hasOwnProperty.call(args, 'notes')) {
    patch.notes = args.notes
  }

  return patch
}

async function updateOrderContact(args = {}, context = {}) {
  try {
    const userId = normalizeUserId(context)
    if (!isMongoObjectId(userId)) {
      return JSON.stringify({
        success: false,
        requiresLogin: true,
        message: 'Khach can dang nhap de sua thong tin lien he cua don hang.'
      })
    }

    const resolved = await resolveOwnOrderId(userId, {
      orderId: args.orderId,
      orderCode: args.orderCode
    })
    if (resolved.error) return JSON.stringify({ success: false, ...resolved.error })

    const result = await ordersService.updateOrderContact(
      userId,
      resolved.orderId,
      buildOrderContactPatch(args)
    )

    return JSON.stringify({
      success: true,
      message: 'Da cap nhat thong tin lien he cua don hang.',
      order: buildOrderDetailPayload(result.order)
    })
  } catch (err) {
    logger.error('[AI Tool] updateOrderContact error:', err.message)
    return JSON.stringify({
      success: false,
      message: err.message || 'Khong the cap nhat thong tin lien he cua don hang.',
      error: 'Loi khi cap nhat thong tin lien he don hang.'
    })
  }
}

function normalizePendingOrderToolMode(value) {
  const normalized = cleanString(value).toLowerCase()
  return ['replace', 'update', 'add', 'remove'].includes(normalized) ? normalized : 'replace'
}

function normalizePendingOrderToolQuantity(value, {
  defaultQuantity = 1,
  allowZero = false,
  required = false
} = {}) {
  if (value === undefined || value === null || value === '') {
    return required ? null : defaultQuantity
  }

  const normalized = Number(value)
  if (!Number.isInteger(normalized) || normalized < 0) return null
  if (!allowZero && normalized < 1) return null

  return normalized
}

function normalizePendingOrderToolItem(item = {}, options = {}) {
  const source = item && typeof item === 'object' ? item : {}
  const productId = cleanString(source.productId || source.id)
  const productQuery = cleanString(
    source.productQuery
    || source.query
    || source.slug
    || source.name
    || source.title
  )
  const quantity = normalizePendingOrderToolQuantity(source.quantity, options)

  return {
    productId,
    productQuery,
    quantity
  }
}

function normalizePendingOrderToolItems(value, options = {}) {
  const rawItems = Array.isArray(value)
    ? value
    : (value && typeof value === 'object' ? [value] : [])

  return rawItems
    .map(item => normalizePendingOrderToolItem(item, options))
    .filter(item => item.productId || item.productQuery)
}

function getPendingOrderCurrentItemsMap(order = {}) {
  const source = getOrderObject(order)
  const currentItems = Array.isArray(source.orderItems) ? source.orderItems : []
  const map = new Map()

  currentItems.forEach(item => {
    const productId = serializeId(item.productId)
    const quantity = normalizeQuantity(item.quantity, 0)
    if (!productId || quantity < 1) return

    map.set(productId, { productId, quantity })
  })

  return map
}

function findPendingOrderCurrentProductId(order = {}, productQuery = '') {
  const query = cleanString(productQuery).toLowerCase()
  if (!query) return ''

  const source = getOrderObject(order)
  const currentItems = Array.isArray(source.orderItems) ? source.orderItems : []
  const match = currentItems.find(item => {
    const name = cleanString(item.name).toLowerCase()
    const slug = cleanString(item.slug).toLowerCase()
    const productId = serializeId(item.productId).toLowerCase()

    return query === name || query === slug || query === productId
  })

  return match ? serializeId(match.productId) : ''
}

async function resolvePendingOrderToolProductId(item = {}, order = {}) {
  if (isMongoObjectId(item.productId)) {
    if (getPendingOrderCurrentItemsMap(order).has(item.productId)) {
      return { productId: item.productId }
    }

    const product = await resolveProductForCartInput(item)
    if (!isSellableProduct(product)) {
      return {
        error: {
          success: false,
          message: `Khong tim thay san pham "${item.productQuery || item.productId || ''}" de cap nhat don hang.`
        }
      }
    }

    return { productId: product._id.toString() }
  }

  const currentProductId = findPendingOrderCurrentProductId(order, item.productQuery)
  if (currentProductId) {
    return { productId: currentProductId }
  }

  const product = await resolveProductForCartInput(item)
  if (!isSellableProduct(product)) {
    return {
      error: {
        success: false,
        message: `Khong tim thay san pham "${item.productQuery || item.productId || ''}" de cap nhat don hang.`
      }
    }
  }

  return { productId: product._id.toString() }
}

async function buildPendingOrderReplacementItems(rawItems = [], order = {}) {
  const itemsMap = new Map()

  for (const item of rawItems) {
    if (!item.quantity || item.quantity < 1) {
      return {
        error: {
          success: false,
          message: 'So luong san pham cap nhat phai lon hon 0.'
        }
      }
    }

    const resolved = await resolvePendingOrderToolProductId(item, order)
    if (resolved.error) return resolved

    const current = itemsMap.get(resolved.productId)
    itemsMap.set(resolved.productId, {
      productId: resolved.productId,
      quantity: (current?.quantity || 0) + item.quantity
    })
  }

  return { items: [...itemsMap.values()] }
}

async function applyPendingOrderItemSet(itemsMap, item = {}, order = {}) {
  if (item.quantity === null) {
    return {
      error: {
        success: false,
        message: 'Can cung cap so luong moi khi sua san pham trong don pending.'
      }
    }
  }

  const resolved = await resolvePendingOrderToolProductId(item, order)
  if (resolved.error) return resolved

  if (item.quantity === 0) {
    itemsMap.delete(resolved.productId)
  } else {
    itemsMap.set(resolved.productId, {
      productId: resolved.productId,
      quantity: item.quantity
    })
  }

  return {}
}

async function applyPendingOrderItemAdd(itemsMap, item = {}, order = {}) {
  if (!item.quantity || item.quantity < 1) {
    return {
      error: {
        success: false,
        message: 'Can cung cap so luong lon hon 0 khi them san pham vao don pending.'
      }
    }
  }

  const resolved = await resolvePendingOrderToolProductId(item, order)
  if (resolved.error) return resolved

  const current = itemsMap.get(resolved.productId)
  itemsMap.set(resolved.productId, {
    productId: resolved.productId,
    quantity: (current?.quantity || 0) + item.quantity
  })

  return {}
}

async function applyPendingOrderItemRemove(itemsMap, item = {}, order = {}) {
  const resolved = await resolvePendingOrderToolProductId(item, order)
  if (resolved.error) return resolved

  itemsMap.delete(resolved.productId)
  return {}
}

async function buildPendingOrderItemsUpdatePayload(args = {}, order = {}) {
  const mode = normalizePendingOrderToolMode(args.mode || args.operation)
  const replacementItems = normalizePendingOrderToolItems(args.items || args.orderItems, {
    defaultQuantity: 1,
    allowZero: false
  })

  if (replacementItems.length > 0 && mode === 'replace') {
    return buildPendingOrderReplacementItems(replacementItems, order)
  }

  const itemsMap = getPendingOrderCurrentItemsMap(order)
  let changed = false

  const modeItems = replacementItems.length > 0 ? replacementItems : []
  if (modeItems.length > 0) {
    const normalizedModeItems = mode === 'remove'
      ? normalizePendingOrderToolItems(args.items || args.orderItems, { defaultQuantity: null })
      : normalizePendingOrderToolItems(args.items || args.orderItems, {
        defaultQuantity: mode === 'add' ? 1 : null,
        allowZero: mode !== 'add',
        required: mode === 'update'
      })

    for (const item of normalizedModeItems) {
      const result = mode === 'add'
        ? await applyPendingOrderItemAdd(itemsMap, item, order)
        : (mode === 'remove'
            ? await applyPendingOrderItemRemove(itemsMap, item, order)
            : await applyPendingOrderItemSet(itemsMap, item, order))
      if (result.error) return result
      changed = true
    }
  }

  const updates = normalizePendingOrderToolItems(args.updates, {
    defaultQuantity: null,
    allowZero: true,
    required: true
  })
  for (const item of updates) {
    const result = await applyPendingOrderItemSet(itemsMap, item, order)
    if (result.error) return result
    changed = true
  }

  const addItems = normalizePendingOrderToolItems(args.addItems, {
    defaultQuantity: 1,
    allowZero: false
  })
  for (const item of addItems) {
    const result = await applyPendingOrderItemAdd(itemsMap, item, order)
    if (result.error) return result
    changed = true
  }

  const removeItems = normalizePendingOrderToolItems(args.removeItems, {
    defaultQuantity: null
  })
  for (const item of removeItems) {
    const result = await applyPendingOrderItemRemove(itemsMap, item, order)
    if (result.error) return result
    changed = true
  }

  if (cleanString(args.productId || args.productQuery)) {
    const item = normalizePendingOrderToolItem(args, {
      defaultQuantity: null,
      allowZero: true,
      required: true
    })
    const result = await applyPendingOrderItemSet(itemsMap, item, order)
    if (result.error) return result
    changed = true
  }

  if (!changed) {
    return {
      error: {
        success: false,
        message: 'Chua co thay doi san pham/so luong nao de cap nhat.'
      }
    }
  }

  const items = [...itemsMap.values()].filter(item => item.quantity > 0)
  if (items.length === 0) {
    return {
      error: {
        success: false,
        message: 'Don hang phai con it nhat mot san pham sau khi cap nhat.'
      }
    }
  }

  return { items }
}

async function updatePendingOrderItems(args = {}, context = {}) {
  try {
    const userId = normalizeUserId(context)
    if (!isMongoObjectId(userId)) {
      return JSON.stringify({
        success: false,
        requiresLogin: true,
        message: 'Khach can dang nhap de sua san pham trong don pending.'
      })
    }

    const { order, error } = await resolveOwnedOrderForPayment({
      userId,
      orderId: args.orderId,
      orderCode: args.orderCode
    })
    if (error) return JSON.stringify(error)

    const paymentCheckError = await ensureOrderCanResumePayment(order)
    if (paymentCheckError) return JSON.stringify(paymentCheckError)

    const updatePayload = await buildPendingOrderItemsUpdatePayload(args, order)
    if (updatePayload.error) return JSON.stringify(updatePayload.error)

    const result = await ordersService.updatePendingOrderItems(userId, order._id.toString(), {
      items: updatePayload.items
    })
    const updatedOrder = result.order
    const paymentReference = getOrderPaymentReference(updatedOrder)
    const payment = await createOnlinePaymentRequest(
      updatedOrder.paymentMethod,
      updatedOrder._id.toString(),
      userId,
      paymentReference
    )

    if (updatedOrder.paymentMethod === 'sepay') {
      payment.bankInfo = await getActiveBankInfoPayload({ order: updatedOrder, paymentReference })
    }

    return JSON.stringify({
      success: true,
      requiresPayment: true,
      paymentRefreshed: true,
      message: payment.paymentUrl
        ? 'Da cap nhat san pham/so luong trong don pending. Vui long dung link thanh toan moi de hoan tat don.'
        : 'Da cap nhat san pham/so luong trong don pending. Vui long chuyen khoan dung so tien va noi dung thanh toan moi.',
      order: buildOrderDetailPayload(updatedOrder),
      previous: {
        ...result.previous,
        subtotalFormatted: formatPrice(result.previous?.subtotal),
        discountFormatted: formatPrice(result.previous?.discount),
        shippingFormatted: formatPrice(result.previous?.shipping),
        totalFormatted: formatPrice(result.previous?.total)
      },
      payment
    })
  } catch (err) {
    logger.error('[AI Tool] updatePendingOrderItems error:', err.message)
    return JSON.stringify({
      success: false,
      message: err.message || 'Khong the cap nhat san pham/so luong trong don pending.',
      error: 'Loi khi cap nhat san pham don pending.'
    })
  }
}

function normalizePaymentToolMethod(paymentMethod) {
  const normalized = cleanString(paymentMethod).toLowerCase()
  if (!normalized) return null
  if (normalized === 'card') return 'vnpay'
  return PLACE_ORDER_PAYMENT_METHODS.includes(normalized) ? normalized : null
}

function getOrderPaymentReference(order = {}) {
  const source = getOrderObject(order)
  return cleanString(source.orderCode) || source._id?.toString?.() || String(source._id || '')
}

function isPendingPayableOrder(order = {}) {
  const source = getOrderObject(order)
  return source.status === 'pending'
    && source.paymentStatus === 'pending'
    && PLACE_ORDER_PAYMENT_METHODS.includes(source.paymentMethod)
    && source.isDeleted !== true
}

function buildPendingPaymentOrderPreview(order = {}) {
  const source = getOrderObject(order)
  return {
    ...buildOrderPayload(source),
    code: source.orderCode || formatOrderCode(source),
    paymentMethod: source.paymentMethod,
    paymentStatus: source.paymentStatus,
    status: source.status,
    expiresAt: source.reservationExpiresAt || null,
    paymentReference: getOrderPaymentReference(source)
  }
}

function buildPaymentStatusSelectionPayload(order = {}) {
  const source = getOrderObject(order)

  return {
    ...buildOrderPayload(source),
    statusLabel: ORDER_STATUS_LABELS[source.status] || source.status,
    paymentMethodLabel: PAYMENT_METHOD_LABELS[source.paymentMethod] || source.paymentMethod,
    paymentStatusLabel: PAYMENT_STATUS_LABELS[source.paymentStatus] || source.paymentStatus,
    transactionId: source.paymentTransactionId || null,
    paymentReference: getOrderPaymentReference(source),
    expiresAt: source.reservationExpiresAt || null,
    paymentExpiredAt: source.paymentExpiredAt || null,
    updatedAt: source.updatedAt || null
  }
}

function getPaymentStatusMessage(order = {}, { expired = false } = {}) {
  const source = getOrderObject(order)
  const code = formatOrderCode(source)
  const methodLabel = PAYMENT_METHOD_LABELS[source.paymentMethod] || source.paymentMethod || 'khong ro'

  if (source.paymentStatus === 'paid') {
    return `Don ${code} da thanh toan thanh cong qua ${methodLabel}.`
  }

  if (expired) {
    return `Don ${code} da het han thanh toan. He thong chua ghi nhan thanh toan hop le trong thoi gian cho thanh toan.`
  }

  if (source.paymentStatus === 'failed' || source.status === 'cancelled') {
    return `Don ${code} khong con o trang thai cho thanh toan. Trang thai hien tai: ${PAYMENT_STATUS_LABELS[source.paymentStatus] || source.paymentStatus}.`
  }

  if (source.paymentStatus === 'pending') {
    if (source.paymentMethod === 'sepay') {
      return `Don ${code} chua ghi nhan thanh toan Sepay. Vui long kiem tra dung so tien va noi dung chuyen khoan ${getOrderPaymentReference(source)}.`
    }

    if (PLACE_ORDER_PAYMENT_METHODS.includes(source.paymentMethod)) {
      return `Don ${code} dang cho thanh toan qua ${methodLabel}. Co the dung resumePayment de lay lai link thanh toan neu can.`
    }
  }

  return `Trang thai thanh toan cua don ${code}: ${PAYMENT_STATUS_LABELS[source.paymentStatus] || source.paymentStatus || 'khong ro'}.`
}

function buildPaymentStatusPayload(order = {}, { expired = false } = {}) {
  const source = getOrderObject(order)
  const effectivePaymentStatus = expired ? 'expired' : source.paymentStatus
  const paymentReference = getOrderPaymentReference(source)
  const canResumePayment = !expired && isPendingPayableOrder(source)

  return {
    found: true,
    paid: source.paymentStatus === 'paid',
    pending: source.paymentStatus === 'pending' && !expired,
    failed: source.paymentStatus === 'failed' || source.status === 'cancelled',
    expired,
    paymentStatus: source.paymentStatus,
    effectivePaymentStatus,
    paymentStatusLabel: expired
      ? 'Het han thanh toan'
      : (PAYMENT_STATUS_LABELS[source.paymentStatus] || source.paymentStatus),
    paymentMethod: source.paymentMethod,
    paymentMethodLabel: PAYMENT_METHOD_LABELS[source.paymentMethod] || source.paymentMethod,
    transactionId: source.paymentTransactionId || null,
    paymentReference,
    canResumePayment,
    canVerifyBankTransfer: source.paymentMethod === 'sepay',
    suggestedTool: canResumePayment
      ? (source.paymentMethod === 'sepay' ? 'getBankInfo' : 'resumePayment')
      : null,
    order: {
      ...buildPaymentStatusSelectionPayload(source),
      expectedTransferContent: source.paymentMethod === 'sepay' ? paymentReference : null
    },
    message: getPaymentStatusMessage(source, { expired })
  }
}

async function resolveGuestOrderForPaymentStatus({ orderId, orderCode, phone } = {}) {
  const lookup = normalizeOrderLookupValue({ orderId, orderCode })
  const normalizedPhone = normalizePhone(phone)

  if (!lookup) {
    return {
      error: {
        found: false,
        message: 'Vui long cung cap ma don hang can kiem tra thanh toan.'
      }
    }
  }

  if (!normalizedPhone) {
    return {
      error: {
        found: false,
        requiresPhone: true,
        message: 'Khach chua dang nhap can cung cap so dien thoai dat hang de kiem tra trang thai thanh toan.'
      }
    }
  }

  let order = null

  if (isMongoObjectId(lookup)) {
    order = await orderRepository.findOne({
      _id: lookup,
      'contact.phone': normalizedPhone,
      isDeleted: false
    })
  }

  if (!order) {
    order = await orderRepository.findOne({
      orderCode: { $regex: `^${escapeRegExp(lookup)}$`, $options: 'i' },
      'contact.phone': normalizedPhone,
      isDeleted: false
    })
  }

  if (!order) {
    return {
      error: {
        found: false,
        message: 'Khong tim thay don hang khop voi ma don va so dien thoai.'
      }
    }
  }

  return { order }
}

async function closeExpiredPaymentIfNeeded(order) {
  if (!order || order.paymentStatus !== 'pending' || !paymentService.isPaymentWindowExpired(order)) {
    return false
  }

  await paymentService.closeExpiredPaymentOrder(order)
  return true
}

function normalizeBankTransferLookup({ orderCode, paymentReference } = {}) {
  return cleanString(paymentReference || orderCode).replace(/^#/, '')
}

async function findOrderByBankTransferLookup({ orderCode, paymentReference } = {}) {
  const lookup = normalizeBankTransferLookup({ orderCode, paymentReference })
  if (!lookup) return null

  if (isMongoObjectId(lookup)) {
    const order = await orderRepository.findByIdNotDeleted(lookup)
    if (order) return order
  }

  return orderRepository.findOne({
    orderCode: { $regex: `^${escapeRegExp(lookup)}$`, $options: 'i' },
    isDeleted: false
  })
}

function canExposeBankTransferOrder(order = {}, userId = null) {
  const source = getOrderObject(order)
  if (!isMongoObjectId(userId) || !source.userId) return true
  return source.userId.toString() === userId.toString()
}

function getBankTransferVerificationMessage(order = {}, { expired = false } = {}) {
  const source = getOrderObject(order)
  const code = formatOrderCode(source)

  if (source.paymentStatus === 'paid') {
    return `He thong da ghi nhan thanh toan cho don ${code}.`
  }

  if (expired) {
    return `Don ${code} da het han thanh toan. He thong chua ghi nhan chuyen khoan hop le trong thoi gian thanh toan.`
  }

  if (source.paymentStatus === 'failed' || source.status === 'cancelled') {
    return `Don ${code} khong con o trang thai cho thanh toan.`
  }

  if (source.paymentMethod !== 'sepay') {
    return `Don ${code} dang dung phuong thuc thanh toan ${source.paymentMethod}; trang thai hien tai la ${PAYMENT_STATUS_LABELS[source.paymentStatus] || source.paymentStatus}.`
  }

  return `He thong chua ghi nhan chuyen khoan khop voi don ${code}. Vui long kiem tra dung so tien va noi dung chuyen khoan.`
}

function buildBankTransferVerificationPayload(order = {}, { expired = false } = {}) {
  const source = getOrderObject(order)
  const effectivePaymentStatus = expired ? 'expired' : source.paymentStatus
  const paymentReference = getOrderPaymentReference(source)

  return {
    found: true,
    verified: source.paymentStatus === 'paid',
    paid: source.paymentStatus === 'paid',
    pending: source.paymentStatus === 'pending' && !expired,
    expired,
    paymentStatus: source.paymentStatus,
    effectivePaymentStatus,
    paymentStatusLabel: expired
      ? 'Het han thanh toan'
      : (PAYMENT_STATUS_LABELS[source.paymentStatus] || source.paymentStatus),
    order: {
      id: source._id?.toString?.() || null,
      orderCode: cleanString(source.orderCode) || null,
      code: formatOrderCode(source),
      status: source.status,
      statusLabel: ORDER_STATUS_LABELS[source.status] || source.status,
      paymentMethod: source.paymentMethod,
      total: Number(source.total || 0),
      totalFormatted: formatPrice(source.total),
      paymentReference,
      expectedTransferContent: paymentReference,
      transactionId: source.paymentTransactionId || null,
      expiresAt: source.reservationExpiresAt || null,
      updatedAt: source.updatedAt || null,
      orderUrl: source._id ? `${CLIENT_URL}/orders/${source._id.toString()}` : null
    },
    message: getBankTransferVerificationMessage(source, { expired })
  }
}

async function findPendingPaymentOrders(userId, limit = 5) {
  return orderRepository.findByQuery({
    userId,
    isDeleted: false,
    status: 'pending',
    paymentStatus: 'pending',
    paymentMethod: { $in: PLACE_ORDER_PAYMENT_METHODS }
  }, {
    sort: { createdAt: -1 },
    limit
  })
}

async function resolveOwnedOrderForPayment({ userId, orderId, orderCode } = {}) {
  const hasLookup = !!cleanString(orderId || orderCode)

  if (hasLookup) {
    const resolved = await resolveOwnOrderId(userId, { orderId, orderCode })
    if (resolved.error) return { error: { success: false, ...resolved.error } }

    const order = await orderRepository.findOne({
      _id: resolved.orderId,
      userId,
      isDeleted: false
    })

    if (!order) {
      return {
        error: {
          success: false,
          found: false,
          message: 'Khong tim thay don hang trong tai khoan dang chat.'
        }
      }
    }

    return { order }
  }

  const pendingOrders = await findPendingPaymentOrders(userId, 5)
  if (pendingOrders.length === 0) {
    return {
      error: {
        success: false,
        found: false,
        message: 'Khong tim thay don pending nao can thanh toan trong tai khoan dang chat.'
      }
    }
  }

  if (pendingOrders.length > 1) {
    return {
      error: {
        success: false,
        requiresOrderSelection: true,
        message: 'Tim thay nhieu don pending. Vui long chon dung ma don can lay lai link thanh toan.',
        orders: pendingOrders.map(buildPendingPaymentOrderPreview)
      }
    }
  }

  return { order: pendingOrders[0] }
}

function buildExpiredPaymentResponse(order) {
  return {
    success: false,
    expired: true,
    order: buildPendingPaymentOrderPreview(order),
    message: 'Don hang da het han thanh toan. Vui long tao don moi neu van muon mua.'
  }
}

async function ensureOrderCanResumePayment(order) {
  if (!isPendingPayableOrder(order)) {
    return {
      success: false,
      payable: false,
      order: buildPendingPaymentOrderPreview(order),
      message: 'Don hang nay khong con o trang thai cho thanh toan.'
    }
  }

  if (paymentService.isClosedForPayment(order)) {
    return {
      success: false,
      payable: false,
      order: buildPendingPaymentOrderPreview(order),
      message: 'Don hang da dong hoac khong the thanh toan tiep.'
    }
  }

  if (paymentService.isPaymentWindowExpired(order)) {
    await paymentService.closeExpiredPaymentOrder(order)
    return buildExpiredPaymentResponse(order)
  }

  return null
}

function getNormalizedBankInfoAmount({ amount, order } = {}) {
  const explicitAmount = Number(amount)
  if (Number.isFinite(explicitAmount) && explicitAmount > 0) return explicitAmount

  const orderTotal = Number(order?.total)
  return Number.isFinite(orderTotal) && orderTotal > 0 ? orderTotal : null
}

function buildBankInfoPayload(bankInfo, { order = null, paymentReference = '', amount = null } = {}) {
  const source = getProductObject(bankInfo) || {}
  const reference = cleanString(paymentReference) || (order ? getOrderPaymentReference(order) : '')
  const normalizedAmount = getNormalizedBankInfoAmount({ amount, order })

  return {
    bankName: source.bankName || '',
    accountNumber: source.accountNumber || '',
    accountHolder: source.accountHolder || '',
    noteTemplate: source.noteTemplate || '',
    qrCode: source.qrCode || '',
    amount: normalizedAmount,
    amountFormatted: normalizedAmount != null ? formatPrice(normalizedAmount) : null,
    paymentReference: reference || null,
    transferContent: reference || source.noteTemplate || '',
    requiresExactTransferContent: !!reference,
    order: order ? buildPendingPaymentOrderPreview(order) : null
  }
}

async function getActiveBankInfoPayload({ order = null, paymentReference = '', amount = null } = {}) {
  const result = await bankInfoService.getActiveBankInfo('vi')
  return buildBankInfoPayload(result.bankInfo, { order, paymentReference, amount })
}

async function checkPaymentStatus({ orderId, orderCode, phone } = {}, context = {}) {
  try {
    const userId = normalizeUserId(context)
    const hasLookup = !!cleanString(orderId || orderCode)
    let order = null

    if (isMongoObjectId(userId)) {
      if (!hasLookup) {
        const result = await ordersService.getMyOrders(userId)
        const orders = Array.isArray(result?.orders) ? result.orders.slice(0, 5) : []

        return JSON.stringify({
          found: orders.length > 0,
          requiresOrderSelection: true,
          message: orders.length > 0
            ? 'Vui long chon ma don hang can kiem tra trang thai thanh toan.'
            : 'Tai khoan dang chat chua co don hang nao de kiem tra.',
          orders: orders.map(buildPaymentStatusSelectionPayload)
        })
      }

      const resolved = await resolveOwnedOrderForPayment({ userId, orderId, orderCode })
      if (resolved.error) return JSON.stringify(resolved.error)
      order = resolved.order
    } else {
      const resolved = await resolveGuestOrderForPaymentStatus({ orderId, orderCode, phone })
      if (resolved.error) return JSON.stringify(resolved.error)
      order = resolved.order
    }

    const expired = await closeExpiredPaymentIfNeeded(order)
    return JSON.stringify(buildPaymentStatusPayload(order, { expired }))
  } catch (err) {
    logger.error('[AI Tool] checkPaymentStatus error:', err.message)
    return JSON.stringify({
      found: false,
      message: err.message || 'Khong the kiem tra trang thai thanh toan.',
      error: 'Loi khi kiem tra trang thai thanh toan.'
    })
  }
}

async function resumePayment({ orderId, orderCode, paymentMethod } = {}, context = {}) {
  try {
    const userId = normalizeUserId(context)
    if (!isMongoObjectId(userId)) {
      return JSON.stringify({
        success: false,
        requiresLogin: true,
        message: 'Khach can dang nhap de lay lai link thanh toan cua don hang.'
      })
    }

    const { order, error } = await resolveOwnedOrderForPayment({ userId, orderId, orderCode })
    if (error) return JSON.stringify(error)

    const paymentCheckError = await ensureOrderCanResumePayment(order)
    if (paymentCheckError) return JSON.stringify(paymentCheckError)

    const requestedMethod = normalizePaymentToolMethod(paymentMethod)
    if (cleanString(paymentMethod) && !requestedMethod) {
      return JSON.stringify({
        success: false,
        message: 'Phuong thuc thanh toan khong hop le. Chi ho tro VNPay, MoMo, ZaloPay hoac Sepay.'
      })
    }

    const selectedMethod = requestedMethod || order.paymentMethod
    if (selectedMethod !== order.paymentMethod) {
      return JSON.stringify({
        success: false,
        methodMismatch: true,
        orderPaymentMethod: order.paymentMethod,
        requestedPaymentMethod: selectedMethod,
        message: 'Phuong thuc thanh toan yeu cau khong khop voi don hang. Vui long tao don moi neu muon doi cong thanh toan.',
        order: buildPendingPaymentOrderPreview(order)
      })
    }

    const paymentReference = getOrderPaymentReference(order)
    const payment = await createOnlinePaymentRequest(
      selectedMethod,
      order._id.toString(),
      userId,
      paymentReference
    )

    if (selectedMethod === 'sepay') {
      payment.bankInfo = await getActiveBankInfoPayload({ order, paymentReference })
    }

    return JSON.stringify({
      success: true,
      requiresPayment: true,
      message: selectedMethod === 'sepay'
        ? 'Da lay lai thong tin thanh toan Sepay. Vui long chuyen khoan dung so tien va noi dung thanh toan.'
        : 'Da tao lai link thanh toan. Vui long mo link de hoan tat don hang.',
      order: buildPendingPaymentOrderPreview(order),
      payment
    })
  } catch (err) {
    logger.error('[AI Tool] resumePayment error:', err.message)
    return JSON.stringify({
      success: false,
      message: err.message || 'Khong the tao lai link thanh toan.',
      error: 'Loi khi tao lai thanh toan.'
    })
  }
}

async function getBankInfo({ orderId, orderCode, paymentReference, amount } = {}, context = {}) {
  try {
    const userId = normalizeUserId(context)
    let order = null
    let orderLookupError = null

    if (cleanString(orderId || orderCode)) {
      if (isMongoObjectId(userId)) {
        const resolved = await resolveOwnedOrderForPayment({ userId, orderId, orderCode })
        order = resolved.order || null
        orderLookupError = resolved.error || null
      } else {
        orderLookupError = {
          requiresLogin: true,
          message: 'Can dang nhap de lay so tien va noi dung chuyen khoan theo don hang.'
        }
      }
    }

    const bankInfo = await getActiveBankInfoPayload({
      order,
      paymentReference,
      amount
    })

    return JSON.stringify({
      found: true,
      bankInfo,
      orderLookupError,
      message: bankInfo.paymentReference
        ? 'Khi chuyen khoan cho don nay, noi dung chuyen khoan can dung dung ma paymentReference.'
        : 'Day la thong tin tai khoan chuyen khoan hien tai cua cua hang.'
    })
  } catch (err) {
    logger.error('[AI Tool] getBankInfo error:', err.message)
    return JSON.stringify({
      found: false,
      message: err.message || 'Khong tim thay thong tin chuyen khoan dang active.',
      error: 'Loi khi lay thong tin chuyen khoan.'
    })
  }
}

const STORE_SOCIAL_MEDIA_FIELDS = ['facebook', 'twitter', 'instagram', 'linkedin']

function getLocalizedWebsiteConfigText(source = {}, language = 'vi', path = '') {
  const normalizedLanguage = normalizePolicyLanguage(language)
  const localizedRoot = getGuideLocalizedRoot(source, normalizedLanguage)
  return getGuideText(source, localizedRoot, path)
}

function buildStoreSocialMediaPayload(contactInfo = {}) {
  const source = contactInfo && typeof contactInfo === 'object' ? contactInfo : {}
  const rawSocialMedia = toPlainObject(source.socialMedia)
  const socialMedia = rawSocialMedia && typeof rawSocialMedia === 'object' && !Array.isArray(rawSocialMedia)
    ? rawSocialMedia
    : {}
  const keys = new Set([...STORE_SOCIAL_MEDIA_FIELDS, ...Object.keys(socialMedia)])

  return Array.from(keys).reduce((result, key) => {
    const value = pickString(socialMedia[key], source[key])
    if (value) result[key] = value
    return result
  }, {})
}

function buildSupportChannelLinks({ hotline, email, socialMedia }) {
  const phone = normalizePhone(hotline)
  const phoneDigits = phone.replace(/\D/g, '')
  const links = {}

  if (phone) links.phone = `tel:${phone}`
  if (email) links.email = `mailto:${email}`
  if (phoneDigits) links.zalo = `https://zalo.me/${phoneDigits}`

  Object.entries(socialMedia || {}).forEach(([key, value]) => {
    if (value) links[key] = value
  })

  return links
}

function buildSupportInfoPayload(config = {}, language = 'vi') {
  const source = toPlainObject(config)
  const contactInfo = toPlainObject(source.contactInfo)
  const shoppingGuide = toPlainObject(source.shoppingGuide)
  const hotline = pickString(contactInfo.hotline, contactInfo.phone)
  const email = pickString(contactInfo.supportEmail, contactInfo.email)
  const supportHours = pickString(
    contactInfo.supportHours,
    contactInfo.workingTime,
    contactInfo.businessHours,
    source.supportHours,
    source.workingTime,
    source.businessHours,
    getLocalizedWebsiteConfigText(shoppingGuide, language, 'supportSection.workingTime')
  )
  const socialMedia = buildStoreSocialMediaPayload(contactInfo)
  const website = pickString(contactInfo.website, source.website, CLIENT_URL)
  const address = pickString(contactInfo.address)
  const hasSupportInfo = Boolean(
    hotline
    || email
    || supportHours
    || Object.keys(socialMedia).length > 0
  )

  return {
    hotline: hotline || null,
    phone: hotline || null,
    email: email || null,
    supportHours: supportHours || null,
    address: address || null,
    website: website || null,
    socialMedia,
    channels: buildSupportChannelLinks({ hotline, email, socialMedia }),
    hasSupportInfo,
    source: 'websiteConfig'
  }
}

function buildStoreLocationAddress(location = {}) {
  const explicitAddress = pickString(location.address)
  if (explicitAddress) return explicitAddress

  return [
    location.addressLine1,
    location.wardName,
    location.districtName,
    location.provinceName
  ].map(value => cleanString(value)).filter(Boolean).join(', ')
}

function buildMapLinks({ address, mapUrl }) {
  const normalizedAddress = cleanString(address)
  const normalizedMapUrl = pickString(mapUrl)
  const searchUrl = normalizedAddress
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(normalizedAddress)}`
    : null

  return {
    mapUrl: normalizedMapUrl || searchUrl,
    directionsUrl: normalizedMapUrl || searchUrl
  }
}

function normalizeStoreLocation(rawLocation = {}, index = 0, config = {}, language = 'vi') {
  const location = toPlainObject(rawLocation)
  const source = toPlainObject(config)
  const contactInfo = toPlainObject(source.contactInfo)
  const shoppingGuide = toPlainObject(source.shoppingGuide)
  const address = buildStoreLocationAddress(location)
  if (!address) return null

  const latitude = Number(location.latitude ?? location.lat)
  const longitude = Number(location.longitude ?? location.lng ?? location.lon)
  const mapUrl = pickString(location.mapUrl, location.googleMapUrl, location.mapsUrl, location.directionUrl)
  const workingHours = pickString(
    location.workingHours,
    location.supportHours,
    location.businessHours,
    contactInfo.supportHours,
    contactInfo.workingTime,
    contactInfo.businessHours,
    getLocalizedWebsiteConfigText(shoppingGuide, language, 'supportSection.workingTime')
  )
  const links = buildMapLinks({ address, mapUrl })

  return {
    id: pickString(location.id, location.key, location._id?.toString?.()) || `store-location-${index + 1}`,
    name: pickString(location.name, location.title, source.siteName) || `Dia diem ${index + 1}`,
    address,
    provinceName: pickString(location.provinceName, location.city) || null,
    districtName: pickString(location.districtName, location.district) || null,
    wardName: pickString(location.wardName, location.ward) || null,
    phone: pickString(location.phone, location.hotline, contactInfo.phone, contactInfo.hotline) || null,
    email: pickString(location.email, contactInfo.email, contactInfo.supportEmail) || null,
    workingHours: workingHours || null,
    note: pickString(location.note, location.notes, location.description) || null,
    isPrimary: location.isPrimary === true || index === 0,
    coordinates: Number.isFinite(latitude) && Number.isFinite(longitude)
      ? { latitude, longitude }
      : null,
    ...links
  }
}

function getConfiguredStoreLocations(config = {}, language = 'vi') {
  const source = toPlainObject(config)
  const contactInfo = toPlainObject(source.contactInfo)
  const rawLocations = [
    ...(
      Array.isArray(contactInfo.locations)
        ? contactInfo.locations
        : []
    ),
    ...(
      Array.isArray(contactInfo.branches)
        ? contactInfo.branches
        : []
    ),
    ...(
      Array.isArray(source.locations)
        ? source.locations
        : []
    )
  ]
  const locations = rawLocations
    .map((location, index) => normalizeStoreLocation(location, index, source, language))
    .filter(Boolean)

  if (locations.length > 0) {
    return locations.sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary))
  }

  const fallbackLocation = normalizeStoreLocation({
    name: source.siteName,
    address: contactInfo.address,
    phone: contactInfo.phone || contactInfo.hotline,
    email: contactInfo.email || contactInfo.supportEmail,
    workingHours: contactInfo.supportHours || contactInfo.workingTime || contactInfo.businessHours
  }, 0, source, language)

  return fallbackLocation ? [fallbackLocation] : []
}

function locationMatchesFilter(location = {}, { city = '', keyword = '' } = {}) {
  const cityFilter = normalizeSearchText(city)
  const keywordFilter = normalizeSearchText(keyword)
  const haystack = normalizeSearchText([
    location.name,
    location.address,
    location.provinceName,
    location.districtName,
    location.wardName,
    location.note
  ].filter(Boolean).join(' '))

  return (!cityFilter || haystack.includes(cityFilter))
    && (!keywordFilter || haystack.includes(keywordFilter))
}

function buildStoreLocationsPayload(config = {}, {
  language = 'vi',
  city = '',
  keyword = '',
  limit = 5
} = {}) {
  const locations = getConfiguredStoreLocations(config, language)
  const filteredLocations = locations.filter(location => locationMatchesFilter(location, { city, keyword }))
  const normalizedLimit = Math.min(Math.max(Number(limit) || 5, 1), 10)

  return {
    found: filteredLocations.length > 0,
    configFound: true,
    language,
    count: Math.min(filteredLocations.length, normalizedLimit),
    totalCount: filteredLocations.length,
    locations: filteredLocations.slice(0, normalizedLimit),
    message: filteredLocations.length > 0
      ? 'Da lay dia diem cua hang tu website config.'
      : 'Website config chua co dia diem cua hang phu hop voi bo loc.'
  }
}

async function getStoreConfig({ language } = {}, context = {}) {
  try {
    const normalizedLanguage = normalizePolicyLanguage(language, context)
    const config = await websiteConfigRepository.findOne({}, { lean: true })

    if (!config) {
      return JSON.stringify({
        found: false,
        message: 'Chua co website config.'
      })
    }

    const source = toPlainObject(config)
    const supportInfo = buildSupportInfoPayload(source, normalizedLanguage)

    return JSON.stringify({
      found: true,
      language: normalizedLanguage,
      store: {
        siteName: pickString(source.siteName) || null,
        type: pickString(source.type) || null,
        description: pickString(source.description) || null,
        website: supportInfo.website || CLIENT_URL,
        logoUrl: pickString(source.logoUrl) || null,
        faviconUrl: pickString(source.faviconUrl) || null
      },
      supportInfo,
      message: supportInfo.hasSupportInfo
        ? 'Da lay cau hinh cua hang tu website config.'
        : 'Website config chua co hotline, email, gio ho tro hoac mang xa hoi.'
    })
  } catch (err) {
    logger.error('[AI Tool] getStoreConfig error:', err.message)
    return JSON.stringify({
      found: false,
      message: 'Khong the lay cau hinh cua hang luc nay.',
      error: 'Loi khi lay website config.'
    })
  }
}

async function getStoreLocations({ language, city, keyword, limit } = {}, context = {}) {
  try {
    const normalizedLanguage = normalizePolicyLanguage(language, context)
    const config = await websiteConfigRepository.findOne({}, { lean: true })

    if (!config) {
      return JSON.stringify({
        found: false,
        configFound: false,
        message: 'Chua co website config.'
      })
    }

    return JSON.stringify(buildStoreLocationsPayload(config, {
      language: normalizedLanguage,
      city,
      keyword,
      limit
    }))
  } catch (err) {
    logger.error('[AI Tool] getStoreLocations error:', err.message)
    return JSON.stringify({
      found: false,
      message: 'Khong the lay dia diem cua hang luc nay.',
      error: 'Loi khi lay dia diem cua hang.'
    })
  }
}

async function getSupportInfo({ language } = {}, context = {}) {
  try {
    const normalizedLanguage = normalizePolicyLanguage(language, context)
    const config = await websiteConfigRepository.findOne({}, { lean: true })

    if (!config) {
      return JSON.stringify({
        found: false,
        configFound: false,
        message: 'Chua co website config.'
      })
    }

    const supportInfo = buildSupportInfoPayload(config, normalizedLanguage)

    return JSON.stringify({
      found: supportInfo.hasSupportInfo,
      configFound: true,
      language: normalizedLanguage,
      ...supportInfo,
      message: supportInfo.hasSupportInfo
        ? 'Da lay thong tin ho tro tu website config.'
        : 'Website config chua co hotline, email, gio ho tro hoac mang xa hoi.'
    })
  } catch (err) {
    logger.error('[AI Tool] getSupportInfo error:', err.message)
    return JSON.stringify({
      found: false,
      message: 'Khong the lay thong tin ho tro luc nay.',
      error: 'Loi khi lay website config.'
    })
  }
}

function buildContactRequestSummary(result = {}, args = {}) {
  const request = result.request || {}
  const contactParts = [
    request.name,
    request.email,
    request.phone
  ].filter(Boolean)
  const subject = cleanString(request.subject || args.subject || 'Yeu cau lien he')
  const contact = contactParts.length > 0 ? contactParts.join(' / ') : 'khach hang'

  return truncateHandoffText(`Contact request ${result.ticketId || request.ticketId || ''}: ${subject} (${contact})`, 500)
}

function buildContactRequestResponse(result = {}, args = {}) {
  const escalationReason = buildContactRequestSummary(result, args)

  return {
    ...result,
    ticketCreated: true,
    handoffRequested: true,
    escalate: true,
    escalationReason,
    reason: escalationReason,
    summary: result.request?.subject || args.subject || result.request?.message || args.message || null,
    priority: result.request?.priority || args.priority || 'normal',
    message: `Minh da ghi nhan yeu cau lien he ${result.ticketId}. Nhan vien ho tro se kiem tra va lien he lai theo thong tin ban da cung cap.`,
    nextAction: 'support_follow_up'
  }
}

async function submitContactRequest(args = {}, context = {}) {
  try {
    const contactService = require('../client/contact.service')
    const result = await contactService.submitContactRequest(args, {
      ...context,
      source: 'chatbot'
    })

    return JSON.stringify(buildContactRequestResponse(result, args))
  } catch (err) {
    if (err.statusCode === 400) {
      logger.warn(`[AI Tool] submitContactRequest validation: ${err.message}`)
      return JSON.stringify({
        success: false,
        found: false,
        requiresContactInfo: /email|so dien thoai|phone/i.test(err.message),
        message: err.message,
        error: 'CONTACT_REQUEST_VALIDATION_FAILED'
      })
    }

    logger.error('[AI Tool] submitContactRequest error:', err.message)

    const fallbackReason = truncateHandoffText(
      `Contact request failed: ${cleanString(args.subject || context.promptText || 'Yeu cau lien he')}`,
      500
    )

    return JSON.stringify({
      success: false,
      ticketCreated: false,
      handoffRequested: true,
      escalate: true,
      escalationReason: fallbackReason,
      reason: fallbackReason,
      summary: cleanString(args.message || context.promptText, 180) || null,
      priority: args.priority || 'normal',
      message: 'Minh chua tao duoc ticket email luc nay, nhung da chuyen thong tin sang nhan vien ho tro trong chat.',
      nextAction: 'notify_support_agents',
      error: 'CONTACT_REQUEST_FAILED'
    })
  }
}

function buildSupportTicketResponse(result = {}, args = {}) {
  const request = result.request || {}

  return {
    ...result,
    ticketCreated: true,
    handoffRequested: false,
    escalate: false,
    ticket: {
      ticketId: result.ticketId || request.ticketId || null,
      category: request.category || args.category || 'general',
      priority: request.priority || args.priority || 'normal',
      subject: request.subject || args.subject || null,
      preferredContactMethod: request.preferredContactMethod || args.preferredContactMethod || args.contactMethod || null,
      createdAt: request.createdAt || null
    },
    message: `Minh da tao ticket ${result.ticketId}. Nhan vien ho tro se theo doi va phan hoi theo thong tin lien he ban da cung cap.`,
    nextAction: 'support_ticket_follow_up'
  }
}

const PERSONAL_DATA_EXPORT_SCOPES = ['all', 'account', 'orders', 'addresses', 'wishlist', 'reviews', 'chat', 'notifications']
const PERSONAL_DATA_EXPORT_FORMATS = ['json', 'csv', 'pdf']

function normalizePersonalDataExportScopes(value) {
  const rawItems = Array.isArray(value)
    ? value
    : (cleanString(value) ? cleanString(value).split(/[,;|]/) : ['all'])
  const scopes = rawItems
    .map(item => cleanString(item).toLowerCase())
    .filter(item => PERSONAL_DATA_EXPORT_SCOPES.includes(item))

  return scopes.length === 0 || scopes.includes('all')
    ? ['all']
    : [...new Set(scopes)]
}

function normalizePersonalDataExportFormat(value) {
  const normalized = cleanString(value).toLowerCase()
  return PERSONAL_DATA_EXPORT_FORMATS.includes(normalized) ? normalized : 'json'
}

function maskEmail(value = '') {
  const email = cleanString(value).toLowerCase()
  const [localPart, domain] = email.split('@')
  if (!localPart || !domain) return ''

  const visibleLocal = localPart.length <= 2
    ? `${localPart[0] || '*'}*`
    : `${localPart.slice(0, 2)}***`

  return `${visibleLocal}@${domain}`
}

function buildPersonalDataExportMessage({ user, scopes, format, reason, context } = {}) {
  const profile = user?.checkoutProfile || {}

  return [
    'Yeu cau xuat du lieu ca nhan tu chatbot.',
    `User ID: ${serializeId(user?._id || user?.id)}`,
    `Username: ${cleanString(user?.username) || '(khong co)'}`,
    `Email tai khoan: ${cleanString(user?.email) || '(khong co)'}`,
    `Ho ten: ${cleanString(user?.fullName || profile.firstName || context.customerInfo?.name) || '(khong co)'}`,
    `So dien thoai: ${normalizePhone(user?.phone || profile.phone || context.customerInfo?.phone) || '(khong co)'}`,
    `Pham vi du lieu: ${scopes.join(', ')}`,
    `Dinh dang mong muon: ${format}`,
    cleanString(reason) ? `Ly do/ghi chu: ${truncateHandoffText(reason, 500)}` : null,
    '',
    'Luu y bao mat: khong gui du lieu ca nhan truc tiep trong chat; chi xu ly qua email tai khoan sau khi nhan vien xac minh.'
  ].filter(line => line !== null).join('\n')
}

function buildPersonalDataExportResponse(result = {}, { scopes, format, deliveryEmail } = {}) {
  const request = result.request || {}

  return {
    ...result,
    ticketCreated: true,
    personalDataExportRequested: true,
    handoffRequested: false,
    escalate: false,
    requestType: 'personal_data_export',
    scopes,
    format,
    deliveryEmailMasked: maskEmail(deliveryEmail),
    ticket: {
      ticketId: result.ticketId || request.ticketId || null,
      category: request.category || 'account',
      priority: request.priority || 'normal',
      subject: request.subject || 'Yeu cau xuat du lieu ca nhan',
      preferredContactMethod: request.preferredContactMethod || 'email',
      createdAt: request.createdAt || null
    },
    summary: request.subject || 'Yeu cau xuat du lieu ca nhan',
    priority: request.priority || 'normal',
    message: `Minh da tao yeu cau xuat du lieu ca nhan ${result.ticketId}. De bao mat, nhan vien se xac minh va phan hoi qua email tai khoan ${maskEmail(deliveryEmail)}; minh khong hien thi du lieu ca nhan truc tiep trong chat.`,
    nextAction: 'personal_data_export_follow_up'
  }
}

async function requestPersonalDataExport(args = {}, context = {}) {
  try {
    const userId = normalizeUserId(context)
    if (!isMongoObjectId(userId)) {
      return JSON.stringify({
        success: false,
        requiresLogin: true,
        message: 'Khach can dang nhap de tao yeu cau xuat du lieu ca nhan.'
      })
    }

    const user = await userRepository.findById(userId, {
      select: 'username email fullName phone checkoutProfile',
      lean: true
    })

    if (!user) {
      return JSON.stringify({
        success: false,
        requiresLogin: true,
        message: 'Khong tim thay tai khoan dang dang nhap de tao yeu cau xuat du lieu.'
      })
    }

    const deliveryEmail = normalizePasswordResetEmail(user.email)
    if (!deliveryEmail) {
      return JSON.stringify({
        success: false,
        requiresEmail: true,
        message: 'Tai khoan chua co email hop le. Vui long cap nhat/xac minh email truoc khi yeu cau xuat du lieu ca nhan.'
      })
    }

    const scopes = normalizePersonalDataExportScopes(args.scopes || args.scope)
    const format = normalizePersonalDataExportFormat(args.format)
    const reason = truncateHandoffText(args.reason || args.notes || args.message, 500)
    const contactService = require('../client/contact.service')
    const result = await contactService.submitContactRequest({
      name: user.fullName || context.customerInfo?.name || user.username,
      email: deliveryEmail,
      phone: normalizePhone(user.phone || user.checkoutProfile?.phone || context.customerInfo?.phone),
      preferredContactMethod: 'email',
      category: 'account',
      priority: 'normal',
      subject: 'Yeu cau xuat du lieu ca nhan',
      message: buildPersonalDataExportMessage({
        user,
        scopes,
        format,
        reason,
        context
      }),
      source: 'chatbot_personal_data_export'
    }, {
      ...context,
      source: 'chatbot_personal_data_export',
      userId
    })

    return JSON.stringify(buildPersonalDataExportResponse(result, {
      scopes,
      format,
      deliveryEmail
    }))
  } catch (err) {
    if (err.statusCode === 400) {
      logger.warn(`[AI Tool] requestPersonalDataExport validation: ${err.message}`)
      return JSON.stringify({
        success: false,
        ticketCreated: false,
        personalDataExportRequested: false,
        message: err.message,
        error: 'PERSONAL_DATA_EXPORT_VALIDATION_FAILED'
      })
    }

    logger.error('[AI Tool] requestPersonalDataExport error:', err.message)

    return JSON.stringify({
      success: false,
      ticketCreated: false,
      personalDataExportRequested: false,
      message: 'Minh chua tao duoc yeu cau xuat du lieu ca nhan luc nay. Ban vui long thu lai hoac yeu cau gap nhan vien neu can ho tro ngay.',
      error: 'PERSONAL_DATA_EXPORT_REQUEST_FAILED'
    })
  }
}

async function createSupportTicket(args = {}, context = {}) {
  try {
    const contactService = require('../client/contact.service')
    const result = await contactService.submitContactRequest(args, {
      ...context,
      source: 'chatbot_ticket'
    })

    return JSON.stringify(buildSupportTicketResponse(result, args))
  } catch (err) {
    if (err.statusCode === 400) {
      logger.warn(`[AI Tool] createSupportTicket validation: ${err.message}`)
      return JSON.stringify({
        success: false,
        ticketCreated: false,
        handoffRequested: false,
        escalate: false,
        requiresContactInfo: /email|so dien thoai|phone/i.test(err.message),
        message: err.message,
        error: 'SUPPORT_TICKET_VALIDATION_FAILED'
      })
    }

    logger.error('[AI Tool] createSupportTicket error:', err.message)

    return JSON.stringify({
      success: false,
      ticketCreated: false,
      handoffRequested: false,
      escalate: false,
      message: 'Minh chua tao duoc ticket ho tro luc nay. Ban vui long thu lai hoac yeu cau gap nhan vien neu can ho tro ngay.',
      error: 'SUPPORT_TICKET_CREATE_FAILED'
    })
  }
}

const SUPPORT_TICKET_SOURCE_TOOLS = ['createSupportTicket', 'reportBugOrIssue', 'requestWarrantySupport', 'requestReturnOrRefund', 'requestPersonalDataExport', 'requestAccountDeletion']
const SUPPORT_TICKET_SOURCE_META = {
  createSupportTicket: {
    type: 'support_ticket',
    label: 'Ticket ho tro'
  },
  reportBugOrIssue: {
    type: 'bug_report',
    label: 'Bao cao loi/su co'
  },
  requestWarrantySupport: {
    type: 'warranty_request',
    label: 'Yeu cau bao hanh'
  },
  requestReturnOrRefund: {
    type: 'return_refund_request',
    label: 'Yeu cau doi tra/hoan tien'
  },
  requestPersonalDataExport: {
    type: 'personal_data_export',
    label: 'Yeu cau xuat du lieu ca nhan'
  },
  requestAccountDeletion: {
    type: 'account_deletion_request',
    label: 'Yeu cau xoa tai khoan'
  }
}
const SUPPORT_TICKET_STATUS_LABELS = {
  submitted: 'Da tiep nhan',
  pending_support_review: 'Dang cho nhan vien ho tro kiem tra',
  error: 'Khong tao thanh cong'
}
const SUPPORT_REQUEST_SOURCE_TOOLS = [
  'submitContactRequest',
  'createSupportTicket',
  'scheduleCallback',
  'reportBugOrIssue',
  'requestWarrantySupport',
  'requestReturnOrRefund',
  'requestPersonalDataExport',
  'requestAccountDeletion'
]
const SUPPORT_REQUEST_SOURCE_META = {
  submitContactRequest: {
    type: 'contact_request',
    label: 'Yeu cau lien he'
  },
  createSupportTicket: {
    type: 'support_ticket',
    label: 'Ticket ho tro'
  },
  scheduleCallback: {
    type: 'callback',
    label: 'Lich goi lai'
  },
  reportBugOrIssue: {
    type: 'bug_report',
    label: 'Bao cao loi/su co'
  },
  requestWarrantySupport: {
    type: 'warranty',
    label: 'Yeu cau bao hanh'
  },
  requestReturnOrRefund: {
    type: 'return_refund',
    label: 'Yeu cau doi tra/hoan tien'
  },
  requestPersonalDataExport: {
    type: 'personal_data_export',
    label: 'Yeu cau xuat du lieu ca nhan'
  },
  requestAccountDeletion: {
    type: 'account_deletion',
    label: 'Yeu cau xoa tai khoan'
  }
}
const SUPPORT_REQUEST_TYPE_TOOLS = {
  all: SUPPORT_REQUEST_SOURCE_TOOLS,
  contact_request: ['submitContactRequest'],
  support_ticket: ['createSupportTicket'],
  callback: ['scheduleCallback'],
  bug_report: ['reportBugOrIssue'],
  warranty: ['requestWarrantySupport'],
  return_refund: ['requestReturnOrRefund'],
  personal_data_export: ['requestPersonalDataExport'],
  account_deletion: ['requestAccountDeletion']
}

function normalizeSupportRequestType(value) {
  const normalized = cleanString(value).toLowerCase()
  return SUPPORT_REQUEST_TYPE_TOOLS[normalized] ? normalized : 'all'
}

function normalizeSupportTicketId(value) {
  const normalized = cleanString(value).replace(/^#/, '').toUpperCase()
  const ticketMatch = normalized.match(/CR-\d{8}-\d{6}-[A-Z0-9]+/)

  return ticketMatch ? ticketMatch[0] : normalized
}

function getSupportTicketObject(value) {
  return value && typeof value === 'object' ? value : {}
}

function extractSupportTicketPayload(payload = {}, fallbackTicketId = '') {
  const ticket = getSupportTicketObject(payload.ticket)
  const request = getSupportTicketObject(payload.request)

  return {
    ticketId: normalizeSupportTicketId(payload.ticketId || ticket.ticketId || request.ticketId || fallbackTicketId),
    category: cleanString(ticket.category || request.category),
    priority: cleanString(ticket.priority || request.priority || payload.priority),
    subject: cleanString(ticket.subject || request.subject || payload.summary),
    createdAt: ticket.createdAt || request.createdAt || null
  }
}

function normalizeSupportTicketStatus(payload = {}) {
  const ticket = getSupportTicketObject(payload.ticket)
  const request = getSupportTicketObject(payload.request)
  const explicitStatus = cleanString(payload.status || ticket.status || request.status).toLowerCase()

  if (explicitStatus) return explicitStatus
  if (payload.success === false || payload.error) return 'error'

  return 'submitted'
}

function getSupportTicketStatusLabel(status) {
  return SUPPORT_TICKET_STATUS_LABELS[status] || status || SUPPORT_TICKET_STATUS_LABELS.submitted
}

function getSupportTicketContactSources(log = {}, payload = {}) {
  const toolArgs = getSupportTicketObject(log.toolArgs)

  return [
    toolArgs,
    getSupportTicketObject(toolArgs.contact),
    getSupportTicketObject(payload.request)
  ]
}

function supportTicketEmailMatches(source = {}, email = '') {
  return !!email && cleanString(source.email).toLowerCase() === email
}

function supportTicketPhoneMatches(source = {}, phone = '') {
  return !!phone && normalizePhone(source.phone) === phone
}

function isSupportTicketLookupVerified(log = {}, args = {}, context = {}, payload = {}) {
  const contextUserId = cleanString(context.userId || context.customerInfo?.userId)
  const contextSessionId = cleanString(context.sessionId)

  if (contextSessionId && cleanString(log.sessionId) === contextSessionId) return true
  if (contextUserId && cleanString(log.userId) === contextUserId) return true

  const email = cleanString(args.email || context.customerInfo?.email).toLowerCase()
  const phone = normalizePhone(args.phone || context.customerInfo?.phone)
  const contactSources = getSupportTicketContactSources(log, payload)

  return contactSources.some(source =>
    supportTicketEmailMatches(source, email) || supportTicketPhoneMatches(source, phone)
  )
}

async function findSupportTicketLog(ticketId) {
  const ticketRegex = new RegExp(escapeRegExp(ticketId), 'i')
  const logs = await agentToolCallRepository.findByQuery({
    toolName: { $in: SUPPORT_TICKET_SOURCE_TOOLS },
    outcome: 'success',
    $or: [
      { resultPayload: ticketRegex },
      { resultPreview: ticketRegex }
    ]
  }, {
    sort: { createdAt: -1 },
    limit: 20,
    lean: true
  })

  return logs.find(log => {
    const payload = parseToolPayload(log.resultPayload) || {}
    const ticket = extractSupportTicketPayload(payload, ticketId)

    return ticket.ticketId === ticketId
      || ticketRegex.test(log.resultPayload || '')
      || ticketRegex.test(log.resultPreview || '')
  }) || null
}

function buildSupportTicketStatusResponse(log = {}, payload = {}, args = {}, context = {}, fallbackTicketId = '') {
  const ticket = extractSupportTicketPayload(payload, fallbackTicketId)
  const status = normalizeSupportTicketStatus(payload)
  const statusLabel = getSupportTicketStatusLabel(status)
  const sourceMeta = SUPPORT_TICKET_SOURCE_META[log.toolName] || {
    type: 'support_ticket',
    label: 'Ticket ho tro'
  }
  const verified = isSupportTicketLookupVerified(log, args, context, payload)
  const createdAt = ticket.createdAt || serializeDate(log.createdAt)
  const response = {
    success: true,
    found: true,
    ticketId: ticket.ticketId,
    status,
    statusLabel,
    processingState: status === 'submitted' ? 'pending_support_review' : status,
    ticketType: sourceMeta.type,
    ticketTypeLabel: sourceMeta.label,
    sourceTool: log.toolName,
    createdAt,
    lastUpdatedAt: serializeDate(log.updatedAt || log.createdAt),
    verified,
    detailsRestricted: !verified,
    statusNote: 'Trang thai duoc lay tu ticket da ghi nhan qua chatbot; khong tu suy doan da xu ly xong neu chua co cap nhat.',
    message: status === 'error'
      ? `Ticket ${ticket.ticketId} chua duoc tao thanh cong.`
      : `Ticket ${ticket.ticketId} da duoc ghi nhan va dang cho nhan vien ho tro kiem tra.`,
    nextAction: 'wait_for_support_response'
  }

  if (verified) {
    response.ticket = {
      ticketId: ticket.ticketId,
      category: ticket.category || null,
      priority: ticket.priority || null,
      subject: ticket.subject || null,
      createdAt
    }
    response.issueType = cleanString(payload.issueType) || null
    response.severity = cleanString(payload.severity) || null
    response.requestType = cleanString(payload.requestType) || null
    response.preferredResolution = cleanString(payload.preferredResolution) || null
    response.warrantyRequestCreated = payload.warrantyRequestCreated === true
    response.requestedResolution = cleanString(payload.requestedResolution) || null
    response.requestedResolutionLabel = cleanString(payload.requestedResolutionLabel) || null
    response.warranty = payload.warranty || null
    response.item = payload.item || null
    response.accountDeletionRequested = payload.accountDeletionRequested === true
  }

  return response
}

function isCreatedSupportRequest(payload = {}) {
  if (!payload || payload.success === false) return false

  return payload.ticketCreated === true
    || payload.callbackScheduled === true
    || payload.bugReportCreated === true
    || payload.returnRequestCreated === true
    || !!payload.ticketId
    || !!payload.ticket?.ticketId
    || !!payload.request?.ticketId
}

function buildSupportRequestCallbackPayload(callback = null) {
  if (!callback || typeof callback !== 'object') return null

  return {
    preferredContactMethod: cleanString(callback.preferredContactMethod) || null,
    callbackAt: cleanString(callback.callbackAt) || null,
    preferredDate: cleanString(callback.preferredDate) || null,
    preferredTime: cleanString(callback.preferredTime) || null,
    preferredTimeWindow: cleanString(callback.preferredTimeWindow) || null,
    timezone: cleanString(callback.timezone) || null,
    reason: truncateHandoffText(callback.reason, 180) || null
  }
}

function buildSupportRequestOrderReference(order = null) {
  if (!order || typeof order !== 'object') return null

  return {
    id: serializeId(order._id || order.id),
    orderCode: cleanString(order.orderCode) || null,
    code: cleanString(order.code) || null,
    status: cleanString(order.status) || null,
    paymentStatus: cleanString(order.paymentStatus) || null,
    totalFormatted: cleanString(order.totalFormatted) || null,
    orderUrl: cleanString(order.orderUrl) || null
  }
}

function buildSupportRequestListItem(log = {}) {
  const payload = parseToolPayload(log.resultPayload) || {}
  if (!isCreatedSupportRequest(payload)) return null

  const ticket = extractSupportTicketPayload(payload)
  const status = normalizeSupportTicketStatus(payload)
  const sourceMeta = SUPPORT_REQUEST_SOURCE_META[log.toolName] || {
    type: 'support_ticket',
    label: 'Ticket ho tro'
  }
  const createdAt = ticket.createdAt || serializeDate(log.createdAt)
  const summary = truncateHandoffText(
    pickString(payload.summary, ticket.subject, payload.message, log.resultPreview),
    240
  )

  return {
    id: serializeId(log._id),
    ticketId: ticket.ticketId || null,
    type: sourceMeta.type,
    typeLabel: sourceMeta.label,
    status,
    statusLabel: getSupportTicketStatusLabel(status),
    processingState: status === 'submitted' ? 'pending_support_review' : status,
    category: ticket.category || null,
    priority: ticket.priority || null,
    subject: ticket.subject || null,
    summary: summary || null,
    createdAt,
    createdAtFormatted: createdAt ? formatDate(createdAt) : null,
    lastUpdatedAt: serializeDate(log.updatedAt || log.createdAt),
    sourceTool: log.toolName,
    sessionId: log.sessionId || null,
    callback: buildSupportRequestCallbackPayload(payload.callback),
    issueType: cleanString(payload.issueType) || null,
    severity: cleanString(payload.severity) || null,
    requestType: cleanString(payload.requestType) || null,
    preferredResolution: cleanString(payload.preferredResolution) || null,
    requestedResolution: cleanString(payload.requestedResolution) || null,
    requestedResolutionLabel: cleanString(payload.requestedResolutionLabel) || null,
    warranty: payload.warranty || null,
    item: payload.item || null,
    accountDeletionRequested: payload.accountDeletionRequested === true,
    order: buildSupportRequestOrderReference(payload.order),
    nextAction: payload.nextAction || null
  }
}

async function listMySupportTickets({ type = 'all', limit = 5 } = {}, context = {}) {
  try {
    const userId = normalizeUserId(context)
    const sessionId = cleanString(context.sessionId)
    const ownershipFilters = []

    if (isMongoObjectId(userId)) ownershipFilters.push({ userId })
    if (sessionId) ownershipFilters.push({ sessionId })

    if (ownershipFilters.length === 0) {
      return JSON.stringify({
        success: false,
        found: false,
        requiresLogin: true,
        message: 'Khach can dang nhap hoac co phien chat hien tai de xem cac yeu cau ho tro gan day.'
      })
    }

    const normalizedType = normalizeSupportRequestType(type)
    const normalizedLimit = Math.min(Math.max(Number(limit) || 5, 1), 10)
    const fetchLimit = Math.min(Math.max(normalizedLimit * 4, 20), 50)
    const filter = {
      toolName: { $in: SUPPORT_REQUEST_TYPE_TOOLS[normalizedType] || SUPPORT_REQUEST_SOURCE_TOOLS }
    }

    if (ownershipFilters.length === 1) {
      Object.assign(filter, ownershipFilters[0])
    } else {
      filter.$or = ownershipFilters
    }

    const logs = await agentToolCallRepository.findByQuery(filter, {
      sort: { createdAt: -1, _id: -1 },
      limit: fetchLimit,
      lean: true
    })
    const tickets = logs
      .map(buildSupportRequestListItem)
      .filter(Boolean)
      .slice(0, normalizedLimit)

    return JSON.stringify({
      success: true,
      found: tickets.length > 0,
      count: tickets.length,
      type: normalizedType,
      scope: isMongoObjectId(userId) ? 'account_or_session' : 'session',
      message: tickets.length > 0
        ? null
        : 'Chua tim thay yeu cau ho tro gan day cho tai khoan hoac phien chat nay.',
      tickets
    })
  } catch (err) {
    logger.error('[AI Tool] listMySupportTickets error:', err.message)

    return JSON.stringify({
      success: false,
      found: false,
      message: 'Khong the lay danh sach yeu cau ho tro luc nay.',
      error: 'SUPPORT_TICKET_LIST_FAILED'
    })
  }
}

async function getSupportTicketStatus(args = {}, context = {}) {
  try {
    const ticketId = normalizeSupportTicketId(args.ticketId || args.ticketCode || args.id)

    if (!ticketId) {
      return JSON.stringify({
        success: false,
        found: false,
        requiresTicketId: true,
        message: 'Vui long cung cap ma ticket ho tro can tra cuu.',
        nextAction: 'ask_for_ticket_id'
      })
    }

    const log = await findSupportTicketLog(ticketId)

    if (!log) {
      return JSON.stringify({
        success: false,
        found: false,
        ticketId,
        message: 'Khong tim thay ticket nay trong cac ticket chatbot da ghi nhan. Vui long kiem tra lai ma ticket hoac lien he nhan vien ho tro.',
        nextAction: 'ask_ticket_id_or_contact_support'
      })
    }

    const payload = parseToolPayload(log.resultPayload) || {}

    return JSON.stringify(buildSupportTicketStatusResponse(log, payload, args, context, ticketId))
  } catch (err) {
    logger.error('[AI Tool] getSupportTicketStatus error:', err.message)

    return JSON.stringify({
      success: false,
      found: false,
      message: 'Minh chua tra cuu duoc trang thai ticket luc nay. Ban vui long thu lai hoac yeu cau gap nhan vien ho tro.',
      error: 'SUPPORT_TICKET_STATUS_LOOKUP_FAILED'
    })
  }
}

const WARRANTY_RESOLUTIONS = ['repair', 'replacement', 'technical_support', 'manufacturer_support', 'other']
const WARRANTY_RESOLUTION_LABELS = {
  repair: 'Sua/chuyen kiem tra loi',
  replacement: 'Doi san pham theo chinh sach',
  technical_support: 'Ho tro ky thuat',
  manufacturer_support: 'Chuyen nha cung cap/nha san xuat',
  other: 'Ho tro khac'
}
const WARRANTY_STATUS_LABELS = {
  active: 'Con trong thoi han ho tro bao hanh du kien',
  expired: 'Co the da het thoi han bao hanh du kien',
  policy_found_needs_review: 'Co thong tin bao hanh, can nhan vien xac minh',
  policy_unknown: 'Chua co du lieu thoi han bao hanh ro rang',
  order_pending: 'Don hang chua hoan tat xu ly',
  payment_not_confirmed: 'Don hang chua ghi nhan thanh toan',
  order_cancelled: 'Don hang da huy',
  ticket_submitted: 'Ticket bao hanh da duoc ghi nhan'
}

function normalizeWarrantyResolution(value) {
  const normalized = normalizeSearchText(value)
  if (normalized.includes('replace') || normalized.includes('doi') || normalized.includes('1 1')) return 'replacement'
  if (normalized.includes('technical') || normalized.includes('ky thuat') || normalized.includes('huong dan')) return 'technical_support'
  if (normalized.includes('manufacturer') || normalized.includes('nha cung cap') || normalized.includes('nha san xuat')) return 'manufacturer_support'
  if (normalized.includes('repair') || normalized.includes('sua') || normalized.includes('khac phuc')) return 'repair'

  const raw = cleanString(value).toLowerCase()
  return WARRANTY_RESOLUTIONS.includes(raw) ? raw : 'technical_support'
}

function normalizeWarrantyMediaUrls(value) {
  const items = Array.isArray(value)
    ? value
    : (cleanString(value) ? [value] : [])

  return [...new Set(items.map(item => cleanString(item)).filter(Boolean))].slice(0, 8)
}

function getWarrantyOrderLookup(args = {}) {
  return cleanString(args.orderId || args.orderCode)
}

async function resolveWarrantyOrder(args = {}, context = {}, options = {}) {
  const userId = normalizeUserId(context)
  const orderLookup = getWarrantyOrderLookup(args)
  const ticketId = cleanString(args.ticketId)

  if (isMongoObjectId(userId)) {
    if (!orderLookup) {
      const result = await ordersService.getMyOrders(userId)
      const orders = Array.isArray(result?.orders) ? result.orders.slice(0, 5) : []

      return {
        error: {
          success: false,
          found: orders.length > 0,
          requiresOrderSelection: true,
          ticketId: ticketId || null,
          message: orders.length > 0
            ? 'Vui long chon ma don hang can kiem tra hoac yeu cau bao hanh.'
            : 'Tai khoan dang chat chua co don hang nao de kiem tra bao hanh.',
          orders: orders.map(buildOrderSummaryPayload)
        }
      }
    }

    const resolved = await resolveOwnOrderId(userId, {
      orderId: args.orderId,
      orderCode: args.orderCode
    })
    if (resolved.error) return { error: { success: false, ...resolved.error } }

    const result = await ordersService.getOrderDetail(userId, resolved.orderId)
    return {
      order: result.order,
      verifiedBy: 'account',
      userId
    }
  }

  if (!orderLookup) {
    return {
      error: {
        success: false,
        found: false,
        requiresLogin: true,
        requiresOrder: true,
        message: options.action === 'request'
          ? 'Khach can dang nhap hoac cung cap ma don hang va so dien thoai dat hang de tao yeu cau bao hanh.'
          : 'Khach can dang nhap hoac cung cap ma don hang va so dien thoai dat hang de kiem tra bao hanh.'
      }
    }
  }

  const phone = normalizePhone(args.phone || args.contact?.phone || context.customerInfo?.phone)
  if (!phone) {
    return {
      error: {
        success: false,
        found: false,
        requiresPhone: true,
        message: 'Vui long cung cap so dien thoai da dung khi dat hang de xac minh don hang.'
      }
    }
  }

  const tracked = await ordersService.trackOrder({
    orderCode: orderLookup,
    phone
  })
  const trackedOrderId = tracked?.order?.id?.toString?.() || String(tracked?.order?.id || '')
  const order = isMongoObjectId(trackedOrderId)
    ? await orderRepository.findOne({ _id: trackedOrderId, isDeleted: false })
    : null

  return {
    order: order || tracked?.order || null,
    verifiedBy: 'order_code_phone',
    userId: null
  }
}

function getWarrantyOrderItems(order = {}) {
  const source = toPlainObject(order)
  return Array.isArray(source.orderItems) ? source.orderItems : []
}

function buildWarrantyOrderItemPayload(item = {}) {
  const productId = serializeId(item.productId)

  return {
    productId: productId || null,
    name: cleanString(item.name) || 'San pham',
    quantity: Number(item.quantity || 0) || null,
    deliveryType: cleanString(item.deliveryType) || null
  }
}

function itemMatchesWarrantyLookup(item = {}, lookup = '') {
  const normalizedLookup = normalizeSearchText(lookup)
  if (!normalizedLookup) return false

  const productId = serializeId(item.productId).toLowerCase()
  if (productId && productId === cleanString(lookup).toLowerCase()) return true

  const normalizedName = normalizeSearchText(item.name)
  if (!normalizedName) return false

  return normalizedName === normalizedLookup
    || normalizedName.includes(normalizedLookup)
    || normalizedLookup.includes(normalizedName)
}

function selectWarrantyOrderItem(order = {}, args = {}) {
  const items = getWarrantyOrderItems(order)
  if (items.length === 0) {
    return {
      error: {
        success: false,
        found: false,
        message: 'Don hang nay khong co san pham de kiem tra bao hanh.'
      }
    }
  }

  const lookup = cleanString(args.productId || args.productQuery || args.productName || args.itemName)
  if (!lookup && items.length === 1) return { item: items[0] }

  if (!lookup) {
    return {
      error: {
        success: false,
        found: true,
        requiresProductSelection: true,
        message: 'Don hang co nhieu san pham. Vui long chon san pham can kiem tra bao hanh.',
        items: items.map(buildWarrantyOrderItemPayload)
      }
    }
  }

  const item = items.find(orderItem => itemMatchesWarrantyLookup(orderItem, lookup))
  if (!item) {
    return {
      error: {
        success: false,
        found: false,
        requiresProductSelection: true,
        message: 'Khong tim thay san pham khop trong don hang nay.',
        items: items.map(buildWarrantyOrderItemPayload)
      }
    }
  }

  return { item }
}

async function resolveWarrantyProduct(item = {}, args = {}) {
  const productId = cleanString(args.productId) || serializeId(item.productId)
  if (isMongoObjectId(productId)) {
    const product = await productRepository.findById(productId, {
      populate: { path: 'productCategory', select: 'title' },
      lean: true
    })
    if (product) return product
  }

  return findProductByQuery(args.productQuery || item.name || productId)
}

function collectWarrantyPolicyTexts(product = {}, item = {}) {
  const source = toPlainObject(product)
  const translations = toPlainObject(source.translations?.en)
  const rawTexts = [
    source.description,
    source.content,
    source.deliveryInstructions,
    item.deliveryInstructions,
    translations.description,
    translations.content,
    translations.deliveryInstructions,
    ...(Array.isArray(source.features) ? source.features : []),
    ...(Array.isArray(translations.features) ? translations.features : [])
  ]

  return rawTexts.map(value => cleanString(value)).filter(Boolean)
}

function parseWarrantyDuration(text = '') {
  const normalized = normalizeSearchText(text)
  const patterns = [
    /(?:bao hanh|warranty).{0,80}?(\d{1,3})\s*(ngay|day|days|thang|month|months|nam|year|years)/i,
    /(\d{1,3})\s*(ngay|day|days|thang|month|months|nam|year|years).{0,80}?(?:bao hanh|warranty)/i
  ]

  for (const pattern of patterns) {
    const match = normalized.match(pattern)
    if (!match) continue

    const amount = Number(match[1])
    const unit = match[2]
    if (!Number.isFinite(amount) || amount <= 0) continue

    if (['ngay', 'day', 'days'].includes(unit)) {
      return { durationDays: amount, durationLabel: `${amount} ngay` }
    }
    if (['thang', 'month', 'months'].includes(unit)) {
      return { durationDays: amount * 30, durationLabel: `${amount} thang` }
    }
    if (['nam', 'year', 'years'].includes(unit)) {
      return { durationDays: amount * 365, durationLabel: `${amount} nam` }
    }
  }

  return { durationDays: null, durationLabel: null }
}

function extractWarrantyPolicy(product = {}, item = {}) {
  const texts = collectWarrantyPolicyTexts(product, item)
  const warrantyTexts = texts.filter(text => {
    const normalized = normalizeSearchText(text)
    return normalized.includes('bao hanh')
      || normalized.includes('warranty')
      || normalized.includes('1 1')
  })
  const sourceText = warrantyTexts.join(' ') || texts.join(' ')
  const duration = parseWarrantyDuration(sourceText)
  const policyText = warrantyTexts[0] || ''

  return {
    found: warrantyTexts.length > 0 || !!duration.durationDays,
    source: warrantyTexts.length > 0 ? 'product_content' : 'not_found',
    text: policyText ? truncateHandoffText(policyText, 500) : null,
    durationDays: duration.durationDays,
    durationLabel: duration.durationLabel
  }
}

function addDays(date, days) {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

function buildWarrantyWindow(order = {}, policy = {}) {
  const source = toPlainObject(order)
  const startAt = source.createdAt || null
  const durationDays = Number(policy.durationDays)
  if (!startAt || !Number.isFinite(durationDays) || durationDays <= 0) {
    return {
      startedAt: startAt || null,
      expiresAt: null,
      isExpired: null
    }
  }

  const expiresAt = addDays(new Date(startAt), durationDays)
  return {
    startedAt: startAt,
    expiresAt: expiresAt.toISOString(),
    isExpired: expiresAt.getTime() < Date.now()
  }
}

function resolveWarrantyStatus(order = {}, policy = {}, window = {}) {
  const source = toPlainObject(order)

  if (source.status === 'cancelled') return 'order_cancelled'
  if (source.status === 'pending') return 'order_pending'
  if (source.paymentStatus && source.paymentStatus !== 'paid') return 'payment_not_confirmed'
  if (window.isExpired === true) return 'expired'
  if (window.isExpired === false) return 'active'
  if (policy.found) return 'policy_found_needs_review'
  return 'policy_unknown'
}

function buildWarrantyStatusPayload(order = {}, item = {}, product = {}, options = {}) {
  const source = toPlainObject(order)
  const productSource = toPlainObject(product)
  const policy = extractWarrantyPolicy(productSource, item)
  const warrantyWindow = buildWarrantyWindow(source, policy)
  const status = resolveWarrantyStatus(source, policy, warrantyWindow)
  const itemPayload = buildWarrantyOrderItemPayload(item)
  const productId = serializeId(productSource._id || item.productId)

  return {
    success: true,
    found: true,
    verifiedBy: options.verifiedBy || null,
    order: buildOrderSummaryPayload(source),
    item: {
      ...itemPayload,
      productUrl: productSource.slug ? `${CLIENT_URL}/products/${productSource.slug}` : null
    },
    product: {
      productId: productId || itemPayload.productId,
      name: cleanString(productSource.title || item.name) || null,
      slug: cleanString(productSource.slug) || null
    },
    warranty: {
      status,
      statusLabel: WARRANTY_STATUS_LABELS[status] || status,
      eligibleForSupport: ['active', 'policy_found_needs_review', 'policy_unknown'].includes(status),
      policyFound: policy.found,
      policySource: policy.source,
      policyText: policy.text,
      durationDays: policy.durationDays,
      durationLabel: policy.durationLabel,
      startedAt: warrantyWindow.startedAt,
      expiresAt: warrantyWindow.expiresAt,
      isExpired: warrantyWindow.isExpired,
      statusNote: 'Trang thai bao hanh la uoc tinh tu du lieu don hang va noi dung san pham; nhan vien se xac minh dieu kien cuoi cung.'
    },
    suggestedTool: ['active', 'policy_found_needs_review', 'policy_unknown'].includes(status)
      ? 'requestWarrantySupport'
      : null,
    message: buildWarrantyStatusMessage(status, source, itemPayload, policy, warrantyWindow)
  }
}

function buildWarrantyStatusMessage(status, order = {}, item = {}, policy = {}, warrantyWindow = {}) {
  const code = order.orderCode || formatOrderCode(order)
  const productName = item.name || 'san pham'
  const label = WARRANTY_STATUS_LABELS[status] || status

  if (status === 'active') {
    return `${productName} trong don ${code} ${label.toLowerCase()}${warrantyWindow.expiresAt ? ` den ${formatDate(warrantyWindow.expiresAt)}` : ''}.`
  }

  if (status === 'expired') {
    return `${productName} trong don ${code} co the da het bao hanh du kien${warrantyWindow.expiresAt ? ` tu ${formatDate(warrantyWindow.expiresAt)}` : ''}. Neu can, co the tao ticket de nhan vien kiem tra lai.`
  }

  if (status === 'policy_found_needs_review') {
    return `${productName} co thong tin bao hanh trong noi dung san pham, nhung he thong chua xac dinh duoc ngay het han. Nhan vien can kiem tra dieu kien cu the.`
  }

  if (status === 'policy_unknown') {
    return `${productName} chua co thoi han bao hanh ro rang trong du lieu san pham. Co the tao ticket de nhan vien kiem tra chinh sach.`
  }

  return `${productName} trong don ${code} dang o trang thai: ${label}.`
}

async function getWarrantyStatus(args = {}, context = {}) {
  try {
    const ticketId = normalizeSupportTicketId(args.ticketId)
    if (ticketId && !getWarrantyOrderLookup(args)) {
      const log = await findSupportTicketLog(ticketId)
      if (!log) {
        return JSON.stringify({
          success: false,
          found: false,
          ticketId,
          message: 'Khong tim thay ticket bao hanh nay trong cac ticket chatbot da ghi nhan.'
        })
      }

      const payload = parseToolPayload(log.resultPayload) || {}
      return JSON.stringify({
        ...buildSupportTicketStatusResponse(log, payload, args, context, ticketId),
        warrantyTicket: log.toolName === 'requestWarrantySupport'
      })
    }

    const resolved = await resolveWarrantyOrder(args, context)
    if (resolved.error) return JSON.stringify(resolved.error)

    const selected = selectWarrantyOrderItem(resolved.order, args)
    if (selected.error) return JSON.stringify(selected.error)

    const product = await resolveWarrantyProduct(selected.item, args)

    return JSON.stringify(buildWarrantyStatusPayload(resolved.order, selected.item, product, {
      verifiedBy: resolved.verifiedBy
    }))
  } catch (err) {
    logger.error('[AI Tool] getWarrantyStatus error:', err.message)
    return JSON.stringify({
      success: false,
      found: false,
      message: err.message || 'Khong the kiem tra thong tin bao hanh luc nay.',
      error: 'WARRANTY_STATUS_LOOKUP_FAILED'
    })
  }
}

function getWarrantyRequestContact(args = {}, order = {}, context = {}) {
  const source = args.contact && typeof args.contact === 'object' ? args.contact : args
  const customerInfo = context.customerInfo || {}
  const orderContact = toPlainObject(order).contact || {}
  const orderName = [orderContact.firstName, orderContact.lastName].filter(Boolean).join(' ').trim()

  return {
    name: pickString(source.name, source.fullName, customerInfo.name, orderName),
    email: pickString(source.email, customerInfo.email, orderContact.email),
    phone: normalizePhone(pickString(source.phone, args.phone, customerInfo.phone, orderContact.phone)),
    preferredContactMethod: cleanString(source.preferredContactMethod || args.preferredContactMethod) || undefined
  }
}

function buildWarrantySupportMessage({
  args = {},
  order = {},
  item = {},
  warrantyStatus = {},
  requestedResolution,
  mediaUrls = [],
  context = {}
} = {}) {
  const source = toPlainObject(order)
  const code = source.orderCode || formatOrderCode(source) || cleanString(args.orderCode || args.orderId)
  const itemPayload = buildWarrantyOrderItemPayload(item)
  const warranty = warrantyStatus.warranty || {}

  return [
    'Loai yeu cau: Bao hanh san pham',
    `Huong ho tro mong muon: ${WARRANTY_RESOLUTION_LABELS[requestedResolution] || requestedResolution}`,
    `Ma don: ${code || '(khong co)'}`,
    `Trang thai don: ${source.status || '(khong ro)'} / thanh toan: ${source.paymentStatus || '(khong ro)'}`,
    `San pham: ${itemPayload.name}${itemPayload.quantity ? ` x${itemPayload.quantity}` : ''}`,
    warranty.statusLabel ? `Trang thai bao hanh du kien: ${warranty.statusLabel}` : null,
    warranty.durationLabel ? `Thoi han bao hanh tim thay: ${warranty.durationLabel}` : null,
    warranty.expiresAt ? `Ngay het han du kien: ${formatDate(warranty.expiresAt)}` : null,
    warranty.policyText ? `Chinh sach/ghi chu san pham: ${warranty.policyText}` : null,
    mediaUrls.length > 0 ? `Anh/video minh chung: ${mediaUrls.join(' | ')}` : null,
    '',
    `Mo ta loi/tinh trang: ${cleanString(args.issueDescription || args.description || args.reason || args.details)}`,
    cleanString(context.promptText) ? `Noi dung chat gan nhat: ${cleanString(context.promptText)}` : null
  ].filter(line => line !== null).join('\n')
}

async function requestWarrantySupport(args = {}, context = {}) {
  try {
    const issueDescription = cleanString(args.issueDescription || args.description || args.reason || args.details)
    if (!issueDescription) {
      return JSON.stringify({
        success: false,
        ticketCreated: false,
        warrantyRequestCreated: false,
        requiresDescription: true,
        message: 'Vui long cung cap mo ta loi/tinh trang san pham truoc khi tao yeu cau bao hanh.'
      })
    }

    const resolved = await resolveWarrantyOrder(args, context, { action: 'request' })
    if (resolved.error) return JSON.stringify(resolved.error)

    const selected = selectWarrantyOrderItem(resolved.order, args)
    if (selected.error) return JSON.stringify(selected.error)

    const product = await resolveWarrantyProduct(selected.item, args)
    const warrantyStatus = buildWarrantyStatusPayload(resolved.order, selected.item, product, {
      verifiedBy: resolved.verifiedBy
    })
    const requestedResolution = normalizeWarrantyResolution(args.requestedResolution || args.resolution)
    const mediaUrls = normalizeWarrantyMediaUrls(args.mediaUrls || args.mediaUrl || args.screenshotUrls || args.screenshots)
    const contact = getWarrantyRequestContact(args, resolved.order, context)
    const orderSource = toPlainObject(resolved.order)
    const code = orderSource.orderCode || formatOrderCode(orderSource) || cleanString(args.orderCode || args.orderId)
    const itemPayload = buildWarrantyOrderItemPayload(selected.item)
    const subject = truncateHandoffText(`[Bao hanh] Don ${code || 'khong ro'} - ${itemPayload.name}`, 180)
    const priority = normalizeHandoffPriority(args.priority || 'normal')
    const message = buildWarrantySupportMessage({
      args: { ...args, issueDescription },
      order: resolved.order,
      item: selected.item,
      warrantyStatus,
      requestedResolution,
      mediaUrls,
      context
    })

    const contactService = require('../client/contact.service')
    const result = await contactService.submitContactRequest({
      ...contact,
      subject,
      message,
      category: 'warranty',
      priority,
      preferredContactMethod: contact.preferredContactMethod || 'chat',
      currentPage: cleanString(args.currentPage || context.customerInfo?.currentPage),
      source: 'chatbot_warranty'
    }, {
      ...context,
      source: 'chatbot_warranty',
      userId: resolved.userId || context.userId || context.customerInfo?.userId || null
    })

    return JSON.stringify({
      success: true,
      ticketCreated: true,
      warrantyRequestCreated: true,
      ticketId: result.ticketId,
      ticket: {
        ticketId: result.ticketId || result.request?.ticketId || null,
        category: 'warranty',
        priority,
        subject,
        preferredContactMethod: result.request?.preferredContactMethod || contact.preferredContactMethod || 'chat',
        createdAt: result.request?.createdAt || null
      },
      verifiedBy: resolved.verifiedBy,
      requestedResolution,
      requestedResolutionLabel: WARRANTY_RESOLUTION_LABELS[requestedResolution] || requestedResolution,
      order: warrantyStatus.order,
      item: warrantyStatus.item,
      warranty: warrantyStatus.warranty,
      mediaUrls,
      handoffRequested: false,
      escalate: false,
      summary: subject,
      priority,
      message: `Minh da tao yeu cau bao hanh ${result.ticketId}. Nhan vien ho tro se kiem tra dieu kien bao hanh va phan hoi theo thong tin lien he ban da cung cap.`,
      nextAction: 'warranty_support_follow_up'
    })
  } catch (err) {
    if (err.statusCode === 400) {
      logger.warn(`[AI Tool] requestWarrantySupport validation: ${err.message}`)
      return JSON.stringify({
        success: false,
        ticketCreated: false,
        warrantyRequestCreated: false,
        requiresContactInfo: /email|so dien thoai|phone/i.test(err.message),
        message: err.message,
        error: 'WARRANTY_REQUEST_VALIDATION_FAILED'
      })
    }

    logger.error('[AI Tool] requestWarrantySupport error:', err.message)
    return JSON.stringify({
      success: false,
      ticketCreated: false,
      warrantyRequestCreated: false,
      message: 'Minh chua tao duoc yeu cau bao hanh luc nay. Ban vui long thu lai hoac yeu cau gap nhan vien neu can ho tro ngay.',
      error: 'WARRANTY_REQUEST_CREATE_FAILED'
    })
  }
}

const BUG_ISSUE_TYPES = ['website', 'payment', 'product', 'order', 'account', 'technical', 'other']
const BUG_ISSUE_SEVERITIES = ['low', 'normal', 'high', 'urgent']
const BUG_ISSUE_TYPE_LABELS = {
  website: 'Loi website',
  payment: 'Loi thanh toan',
  product: 'Loi san pham',
  order: 'Loi don hang',
  account: 'Loi tai khoan',
  technical: 'Su co ky thuat',
  other: 'Su co khac'
}
const BUG_ISSUE_CATEGORY_MAP = {
  website: 'technical',
  payment: 'payment',
  product: 'product',
  order: 'order',
  account: 'account',
  technical: 'technical',
  other: 'other'
}

function normalizeBugIssueType(value, fallbackText = '') {
  const raw = cleanString(value).toLowerCase()
  if (BUG_ISSUE_TYPES.includes(raw)) return raw

  const normalized = normalizeSearchText(value || fallbackText)
  if (!normalized) return 'technical'

  if (normalized.includes('payment') || normalized.includes('thanh toan') || normalized.includes('vnpay') || normalized.includes('momo') || normalized.includes('zalopay') || normalized.includes('sepay')) return 'payment'
  if (normalized.includes('product') || normalized.includes('san pham') || normalized.includes('hang hoa') || normalized.includes('gia') || normalized.includes('ton kho')) return 'product'
  if (normalized.includes('order') || normalized.includes('don hang') || normalized.includes('giao hang')) return 'order'
  if (normalized.includes('account') || normalized.includes('tai khoan') || normalized.includes('dang nhap') || normalized.includes('login') || normalized.includes('register')) return 'account'
  if (normalized.includes('website') || normalized.includes('web') || normalized.includes('trang') || normalized.includes('checkout') || normalized.includes('gio hang')) return 'website'
  if (normalized.includes('technical') || normalized.includes('bug') || normalized.includes('error') || normalized.includes('loi') || normalized.includes('su co')) return 'technical'

  return 'other'
}

function normalizeBugIssueSeverity(value, issueType) {
  const raw = cleanString(value).toLowerCase()
  if (BUG_ISSUE_SEVERITIES.includes(raw)) return raw

  const normalized = normalizeSearchText(value)
  if (normalized.includes('urgent') || normalized.includes('khong the dung') || normalized.includes('nghiem trong') || normalized.includes('gap')) return 'urgent'
  if (normalized.includes('high') || normalized.includes('cao') || normalized.includes('khong thanh toan') || normalized.includes('mat tien')) return 'high'
  if (normalized.includes('low') || normalized.includes('thap') || normalized.includes('nho')) return 'low'

  return issueType === 'payment' ? 'high' : 'normal'
}

function normalizeBugReportStringList(value) {
  const rawItems = Array.isArray(value)
    ? value
    : (cleanString(value) ? [value] : [])

  return rawItems
    .map(item => cleanString(item))
    .filter(Boolean)
    .slice(0, 6)
}

function getBugReportContact(args = {}, context = {}) {
  const source = args.contact && typeof args.contact === 'object' ? args.contact : args
  const customerInfo = context.customerInfo || {}

  return {
    name: pickString(source.name, source.fullName, customerInfo.name),
    email: pickString(source.email, customerInfo.email),
    phone: normalizePhone(pickString(source.phone, args.phone, customerInfo.phone)),
    preferredContactMethod: cleanString(source.preferredContactMethod || args.preferredContactMethod) || undefined
  }
}

function buildBugReportMessage({
  args = {},
  issueType,
  severity,
  category,
  description,
  context = {}
} = {}) {
  const screenshots = normalizeBugReportStringList(args.screenshotUrls || args.screenshots || args.screenshotUrl)
  const contextPrompt = cleanString(context.promptText)

  return [
    `Loai su co: ${BUG_ISSUE_TYPE_LABELS[issueType] || issueType}`,
    `Muc do: ${severity}`,
    `Danh muc ticket: ${category}`,
    cleanString(args.title || args.subject) ? `Tieu de: ${cleanString(args.title || args.subject)}` : null,
    cleanString(args.pageUrl || args.currentPage) ? `Trang/URL loi: ${cleanString(args.pageUrl || args.currentPage)}` : null,
    cleanString(args.browser) ? `Trinh duyet: ${cleanString(args.browser)}` : null,
    cleanString(args.device) ? `Thiet bi: ${cleanString(args.device)}` : null,
    cleanString(args.orderCode || args.orderId) ? `Don hang lien quan: ${cleanString(args.orderCode || args.orderId)}` : null,
    cleanString(args.paymentReference) ? `Ma thanh toan/giao dich: ${cleanString(args.paymentReference)}` : null,
    cleanString(args.productQuery || args.productId) ? `San pham lien quan: ${cleanString(args.productQuery || args.productId)}` : null,
    screenshots.length > 0 ? `Anh chup man hinh: ${screenshots.join(' | ')}` : null,
    '',
    `Mo ta: ${description}`,
    cleanString(args.stepsToReproduce) ? `Cach tai hien: ${cleanString(args.stepsToReproduce)}` : null,
    cleanString(args.expectedBehavior) ? `Mong doi: ${cleanString(args.expectedBehavior)}` : null,
    cleanString(args.actualBehavior) ? `Thuc te: ${cleanString(args.actualBehavior)}` : null,
    contextPrompt ? `Noi dung chat gan nhat: ${contextPrompt}` : null
  ].filter(line => line !== null).join('\n')
}

function buildBugReportResponse(result = {}, args = {}, meta = {}) {
  const request = result.request || {}

  return {
    ...result,
    ticketCreated: true,
    bugReportCreated: true,
    handoffRequested: false,
    escalate: false,
    issueType: meta.issueType,
    severity: meta.severity,
    ticket: {
      ticketId: result.ticketId || request.ticketId || null,
      category: request.category || meta.category || 'technical',
      priority: request.priority || meta.severity || 'normal',
      subject: request.subject || meta.subject || null,
      preferredContactMethod: request.preferredContactMethod || args.preferredContactMethod || args.contactMethod || null,
      createdAt: request.createdAt || null
    },
    summary: request.subject || meta.subject || null,
    priority: request.priority || meta.severity || 'normal',
    message: `Minh da ghi nhan bao cao loi/su co ${result.ticketId}. Nhan vien ho tro se kiem tra va phan hoi theo thong tin lien he ban da cung cap.`,
    nextAction: 'bug_report_follow_up'
  }
}

async function reportBugOrIssue(args = {}, context = {}) {
  try {
    const description = cleanString(args.description || args.details || args.message)
    if (!description) {
      return JSON.stringify({
        success: false,
        ticketCreated: false,
        bugReportCreated: false,
        requiresDescription: true,
        handoffRequested: false,
        escalate: false,
        message: 'Vui long cung cap mo ta loi/su co truoc khi tao bao cao.'
      })
    }

    const issueType = normalizeBugIssueType(args.issueType || args.type, `${description} ${context.promptText || ''}`)
    const severity = normalizeBugIssueSeverity(args.severity || args.priority, issueType)
    const category = BUG_ISSUE_CATEGORY_MAP[issueType] || 'technical'
    const title = cleanString(args.title || args.subject)
    const subject = truncateHandoffText(
      `[${BUG_ISSUE_TYPE_LABELS[issueType] || 'Su co'}] ${title || description}`,
      180
    )
    const contact = getBugReportContact(args, context)
    const currentPage = cleanString(args.currentPage || args.pageUrl || context.customerInfo?.currentPage)
    const message = buildBugReportMessage({
      args,
      issueType,
      severity,
      category,
      description,
      context
    })

    const contactService = require('../client/contact.service')
    const result = await contactService.submitContactRequest({
      ...contact,
      subject,
      message,
      category,
      priority: severity,
      preferredContactMethod: contact.preferredContactMethod || 'chat',
      currentPage,
      source: 'chatbot_bug_report'
    }, {
      ...context,
      source: 'chatbot_bug_report'
    })

    return JSON.stringify(buildBugReportResponse(result, args, {
      issueType,
      severity,
      category,
      subject
    }))
  } catch (err) {
    if (err.statusCode === 400) {
      logger.warn(`[AI Tool] reportBugOrIssue validation: ${err.message}`)
      return JSON.stringify({
        success: false,
        ticketCreated: false,
        bugReportCreated: false,
        handoffRequested: false,
        escalate: false,
        requiresContactInfo: /email|so dien thoai|phone/i.test(err.message),
        message: err.message,
        error: 'BUG_REPORT_VALIDATION_FAILED'
      })
    }

    logger.error('[AI Tool] reportBugOrIssue error:', err.message)

    return JSON.stringify({
      success: false,
      ticketCreated: false,
      bugReportCreated: false,
      handoffRequested: false,
      escalate: false,
      message: 'Minh chua tao duoc bao cao loi/su co luc nay. Ban vui long thu lai hoac yeu cau gap nhan vien neu can ho tro ngay.',
      error: 'BUG_REPORT_CREATE_FAILED'
    })
  }
}

const CALLBACK_CONTACT_METHODS = ['phone', 'zalo']
const DEFAULT_CALLBACK_TIMEZONE = 'Asia/Ho_Chi_Minh'

function normalizeCallbackContactMethod(value) {
  const normalized = cleanString(value).toLowerCase()
  return CALLBACK_CONTACT_METHODS.includes(normalized) ? normalized : 'phone'
}

function isValidCallbackPhone(phone) {
  const digits = cleanString(phone).replace(/\D/g, '')
  return digits.length >= 8 && digits.length <= 15
}

function buildCallbackDetails(args = {}, context = {}) {
  const contact = args.contact && typeof args.contact === 'object' ? args.contact : {}
  const customerInfo = context.customerInfo || {}
  const phone = normalizePhone(pickString(args.phone, contact.phone, customerInfo.phone))
  const email = pickString(args.email, contact.email, customerInfo.email)
  const name = pickString(args.name, args.fullName, contact.name, contact.fullName, customerInfo.name)
  const callbackAt = pickString(args.callbackAt, args.preferredCallbackAt)
  const preferredDate = pickString(args.preferredDate, args.callbackDate, args.date)
  const preferredTime = pickString(args.preferredTime, args.callbackTime, args.time)
  const preferredTimeWindow = pickString(args.preferredTimeWindow, args.timeWindow, args.window)
  const timezone = pickString(args.timezone, customerInfo.timezone, context.timezone, DEFAULT_CALLBACK_TIMEZONE)
  const reason = truncateHandoffText(
    pickString(args.reason, args.topic, args.subject, context.promptText) || 'Khach yeu cau nhan vien goi lai.',
    500
  )
  const notes = truncateHandoffText(pickString(args.notes, args.details), 1000)
  const preferredContactMethod = normalizeCallbackContactMethod(
    pickString(args.preferredContactMethod, args.contactMethod, contact.preferredContactMethod, contact.contactMethod)
  )
  const whenParts = [
    callbackAt ? `Thoi diem: ${callbackAt}` : null,
    preferredDate ? `Ngay: ${preferredDate}` : null,
    preferredTime ? `Gio: ${preferredTime}` : null,
    preferredTimeWindow ? `Khung gio: ${preferredTimeWindow}` : null
  ].filter(Boolean)

  return {
    name,
    email,
    phone,
    preferredContactMethod,
    callbackAt,
    preferredDate,
    preferredTime,
    preferredTimeWindow,
    timezone,
    reason,
    notes,
    hasRequestedTime: whenParts.length > 0,
    whenLabel: whenParts.join(' | ')
  }
}

function buildCallbackRequestMessage(callback = {}, context = {}) {
  const currentPage = pickString(context.currentPage, context.customerInfo?.currentPage)

  return [
    'Loai yeu cau: Dat lich nhan vien goi lai',
    `Thoi gian mong muon: ${callback.whenLabel}`,
    `Mui gio: ${callback.timezone}`,
    `Kenh uu tien: ${callback.preferredContactMethod}`,
    `So dien thoai: ${callback.phone}`,
    callback.name ? `Ten khach: ${callback.name}` : null,
    callback.email ? `Email: ${callback.email}` : null,
    `Ly do: ${callback.reason}`,
    callback.notes ? `Ghi chu: ${callback.notes}` : null,
    currentPage ? `Trang hien tai: ${currentPage}` : null,
    cleanString(context.promptText) ? `Noi dung chat gan nhat: ${cleanString(context.promptText)}` : null
  ].filter(Boolean).join('\n')
}

function buildScheduleCallbackResponse(result = {}, callback = {}, priority = 'normal') {
  const request = result.request || {}
  const ticketId = result.ticketId || request.ticketId || null
  const ticketText = ticketId ? ` ${ticketId}` : ''
  const whenText = callback.whenLabel || 'khung gio ban da cung cap'

  return {
    ...result,
    ticketCreated: true,
    callbackScheduled: true,
    handoffRequested: false,
    escalate: false,
    ticket: {
      ticketId,
      category: request.category || 'general',
      priority: request.priority || priority,
      subject: request.subject || null,
      createdAt: request.createdAt || null
    },
    callback: {
      phone: request.phone || callback.phone,
      email: request.email || callback.email || null,
      preferredContactMethod: request.preferredContactMethod || callback.preferredContactMethod,
      callbackAt: callback.callbackAt || null,
      preferredDate: callback.preferredDate || null,
      preferredTime: callback.preferredTime || null,
      preferredTimeWindow: callback.preferredTimeWindow || null,
      timezone: callback.timezone,
      reason: callback.reason
    },
    summary: request.subject || callback.reason || null,
    priority: request.priority || priority,
    message: `Minh da ghi nhan lich nhan vien goi lai${ticketText}. Nhan vien se lien he so ${request.phone || callback.phone} theo ${whenText}.`,
    nextAction: 'staff_callback'
  }
}

async function scheduleCallback(args = {}, context = {}) {
  try {
    const callback = buildCallbackDetails(args, context)

    if (!callback.phone) {
      return JSON.stringify({
        success: false,
        callbackScheduled: false,
        requiresPhone: true,
        message: 'Vui long cung cap so dien thoai de nhan vien goi lai.',
        error: 'CALLBACK_PHONE_REQUIRED'
      })
    }

    if (!isValidCallbackPhone(callback.phone)) {
      return JSON.stringify({
        success: false,
        callbackScheduled: false,
        requiresPhone: true,
        message: 'So dien thoai goi lai chua hop le. Vui long cung cap so co 8-15 chu so.',
        error: 'CALLBACK_PHONE_INVALID'
      })
    }

    if (!callback.hasRequestedTime) {
      return JSON.stringify({
        success: false,
        callbackScheduled: false,
        requiresCallbackTime: true,
        message: 'Vui long cho biet ngay, gio hoac khung gio muon nhan vien goi lai.',
        error: 'CALLBACK_TIME_REQUIRED'
      })
    }

    const contactService = require('../client/contact.service')
    const priority = normalizeHandoffPriority(args.priority)
    const subject = truncateHandoffText(
      pickString(args.subject) || `Dat lich goi lai: ${callback.reason}`,
      200
    )
    const result = await contactService.submitContactRequest({
      name: callback.name,
      email: callback.email,
      phone: callback.phone,
      preferredContactMethod: callback.preferredContactMethod,
      category: 'general',
      subject,
      message: buildCallbackRequestMessage(callback, context),
      priority,
      source: 'chatbot_callback'
    }, {
      ...context,
      source: 'chatbot_callback'
    })

    return JSON.stringify(buildScheduleCallbackResponse(result, callback, priority))
  } catch (err) {
    if (err.statusCode === 400) {
      logger.warn(`[AI Tool] scheduleCallback validation: ${err.message}`)
      return JSON.stringify({
        success: false,
        callbackScheduled: false,
        requiresPhone: /so dien thoai|phone/i.test(err.message),
        message: err.message,
        error: 'CALLBACK_VALIDATION_FAILED'
      })
    }

    logger.error('[AI Tool] scheduleCallback error:', err.message)

    const fallbackReason = truncateHandoffText(
      `Callback schedule failed: ${pickString(args.reason, args.subject, context.promptText, 'Dat lich goi lai')}`,
      500
    )

    return JSON.stringify({
      success: false,
      ticketCreated: false,
      callbackScheduled: false,
      handoffRequested: true,
      escalate: true,
      escalationReason: fallbackReason,
      reason: fallbackReason,
      summary: truncateHandoffText(pickString(args.reason, context.promptText), 180) || null,
      priority: args.priority || 'normal',
      message: 'Minh chua tao duoc lich goi lai luc nay, nhung da chuyen thong tin sang nhan vien ho tro trong chat.',
      nextAction: 'notify_support_agents',
      error: 'CALLBACK_SCHEDULE_FAILED'
    })
  }
}

async function verifyBankTransfer({ orderCode, paymentReference } = {}, context = {}) {
  try {
    const lookup = normalizeBankTransferLookup({ orderCode, paymentReference })
    if (!lookup) {
      return JSON.stringify({
        found: false,
        message: 'Vui long cung cap orderCode hoac paymentReference de kiem tra chuyen khoan.'
      })
    }

    const order = await findOrderByBankTransferLookup({ orderCode, paymentReference })
    if (!order) {
      return JSON.stringify({
        found: false,
        message: `Khong tim thay don hang voi ma thanh toan "${lookup}".`
      })
    }

    const userId = normalizeUserId(context)
    if (!canExposeBankTransferOrder(order, userId)) {
      return JSON.stringify({
        found: false,
        message: 'Khong tim thay don hang voi ma thanh toan nay trong tai khoan dang chat.'
      })
    }

    const expired = order.paymentStatus === 'pending' && paymentService.isPaymentWindowExpired(order)

    return JSON.stringify(buildBankTransferVerificationPayload(order, { expired }))
  } catch (err) {
    logger.error('[AI Tool] verifyBankTransfer error:', err.message)
    return JSON.stringify({
      found: false,
      message: err.message || 'Khong the kiem tra trang thai chuyen khoan.',
      error: 'Loi khi kiem tra chuyen khoan.'
    })
  }
}

const RETURN_REQUEST_TYPES = ['return', 'refund', 'exchange', 'return_refund']
const RETURN_RESOLUTIONS = ['refund', 'exchange', 'store_credit', 'repair', 'support']
const RETURN_REQUEST_TYPE_LABELS = {
  return: 'Doi tra/tra hang',
  refund: 'Hoan tien',
  exchange: 'Doi san pham',
  return_refund: 'Doi tra/hoan tien'
}
const RETURN_RESOLUTION_LABELS = {
  refund: 'Hoan tien',
  exchange: 'Doi san pham',
  store_credit: 'Doi thanh diem/tin dung mua hang',
  repair: 'Ho tro sua loi/khac phuc',
  support: 'Can nhan vien tu van'
}
const RETURN_REFUND_STATUSES = ['requested', 'under_review', 'approved', 'rejected', 'processing', 'completed', 'cancelled']
const RETURN_REFUND_SUB_STATUSES = ['not_applicable', ...RETURN_REFUND_STATUSES]
const RETURN_REFUND_STATUS_LABELS = {
  requested: 'Da ghi nhan',
  under_review: 'Dang kiem tra',
  approved: 'Da duyet',
  rejected: 'Tu choi',
  processing: 'Dang xu ly',
  completed: 'Da hoan tat',
  cancelled: 'Da huy'
}
const RETURN_REFUND_SUB_STATUS_LABELS = {
  not_applicable: 'Khong ap dung',
  ...RETURN_REFUND_STATUS_LABELS
}

function normalizeReturnRequestType(value) {
  const normalized = normalizeSearchText(value)

  if (!normalized) return 'return_refund'
  if (normalized.includes('exchange') || normalized.includes('doi san pham') || normalized.includes('doi hang')) return 'exchange'
  if (normalized.includes('refund') || normalized.includes('hoan tien')) return 'refund'
  if (normalized.includes('return') || normalized.includes('tra hang') || normalized.includes('doi tra')) return 'return'

  return RETURN_REQUEST_TYPES.includes(cleanString(value)) ? cleanString(value) : 'return_refund'
}

function normalizeReturnResolution(value, requestType) {
  const normalized = normalizeSearchText(value)

  if (normalized.includes('exchange') || normalized.includes('doi san pham') || normalized.includes('doi hang')) return 'exchange'
  if (normalized.includes('refund') || normalized.includes('hoan tien')) return 'refund'
  if (normalized.includes('store credit') || normalized.includes('diem') || normalized.includes('voucher')) return 'store_credit'
  if (normalized.includes('repair') || normalized.includes('sua') || normalized.includes('khac phuc')) return 'repair'
  if (RETURN_RESOLUTIONS.includes(cleanString(value))) return cleanString(value)

  if (requestType === 'exchange') return 'exchange'
  if (requestType === 'refund' || requestType === 'return_refund') return 'refund'
  return 'support'
}

function normalizeReturnRequestItems(items = []) {
  const rawItems = Array.isArray(items) ? items : []

  return rawItems
    .map(item => {
      const quantity = Number(item?.quantity)
      return {
        productId: cleanString(item?.productId),
        productQuery: cleanString(item?.productQuery || item?.name),
        name: cleanString(item?.name || item?.productQuery),
        quantity: Number.isFinite(quantity) && quantity > 0 ? Math.floor(quantity) : null,
        reason: cleanString(item?.reason, 500)
      }
    })
    .filter(item => item.productId || item.productQuery || item.name || item.reason)
}

function getReturnRequestContact(args = {}, order = {}, context = {}) {
  const source = args.contact && typeof args.contact === 'object' ? args.contact : args
  const customerInfo = context.customerInfo || {}
  const orderContact = toPlainObject(order).contact || {}
  const orderName = [orderContact.firstName, orderContact.lastName].filter(Boolean).join(' ').trim()

  return {
    name: pickString(source.name, source.fullName, customerInfo.name, orderName),
    email: pickString(source.email, customerInfo.email, orderContact.email),
    phone: normalizePhone(pickString(source.phone, args.phone, customerInfo.phone, orderContact.phone)),
    preferredContactMethod: cleanString(source.preferredContactMethod || args.preferredContactMethod) || undefined
  }
}

async function resolveReturnRequestOrder(args = {}, context = {}) {
  const userId = normalizeUserId(context)
  const orderLookup = cleanString(args.orderId || args.orderCode)

  if (isMongoObjectId(userId)) {
    if (!orderLookup) {
      return {
        error: {
          success: false,
          requiresOrder: true,
          message: 'Vui long cung cap ma don hang can tao yeu cau doi tra/hoan tien.'
        }
      }
    }

    const resolved = await resolveOwnOrderId(userId, {
      orderId: args.orderId,
      orderCode: args.orderCode
    })
    if (resolved.error) return { error: { success: false, ...resolved.error } }

    const result = await ordersService.getOrderDetail(userId, resolved.orderId)
    return {
      order: result.order,
      verifiedBy: 'account',
      userId
    }
  }

  if (!orderLookup) {
    return {
      error: {
        success: false,
        requiresLogin: true,
        requiresOrder: true,
        message: 'Khach can dang nhap hoac cung cap ma don hang va so dien thoai dat hang de tao yeu cau doi tra/hoan tien.'
      }
    }
  }

  const phone = normalizePhone(args.phone || args.contact?.phone || context.customerInfo?.phone)
  if (!phone) {
    return {
      error: {
        success: false,
        requiresPhone: true,
        message: 'Vui long cung cap so dien thoai da dung khi dat hang de xac minh don hang.'
      }
    }
  }

  const tracked = await ordersService.trackOrder({
    orderCode: orderLookup,
    phone
  })
  const trackedOrderId = tracked?.order?.id?.toString?.() || String(tracked?.order?.id || '')
  const order = isMongoObjectId(trackedOrderId)
    ? await orderRepository.findOne({ _id: trackedOrderId, isDeleted: false })
    : null

  return {
    order: order || tracked?.order || null,
    verifiedBy: 'order_code_phone',
    userId: null
  }
}

function getReturnRequestWarnings(order = {}, requestType = 'return_refund') {
  const source = toPlainObject(order)
  const warnings = []

  if (!source?._id && !source?.id) return warnings

  if (source.status === 'pending') {
    warnings.push('Don hang dang cho xu ly; neu khach chi muon huy don pending thi nen dung cancelOrder thay vi yeu cau doi tra.')
  }

  if (source.status === 'cancelled') {
    warnings.push('Don hang da bi huy; nhan vien se can kiem tra truoc khi xu ly hoan tien/doi tra.')
  }

  if (['refund', 'return_refund'].includes(requestType) && source.paymentStatus && source.paymentStatus !== 'paid') {
    warnings.push('Don hang chua ghi nhan thanh toan thanh cong; khong duoc noi la da duyet hoan tien.')
  }

  return warnings
}

function normalizeReturnRefundStatus(value, fallback = 'requested') {
  const normalized = cleanString(value).toLowerCase()
  return RETURN_REFUND_STATUSES.includes(normalized) ? normalized : fallback
}

function normalizeReturnRefundSubStatus(value, fallback = 'not_applicable') {
  const normalized = cleanString(value).toLowerCase()
  return RETURN_REFUND_SUB_STATUSES.includes(normalized) ? normalized : fallback
}

function getReturnRefundRecord(order = {}) {
  const source = toPlainObject(order)
  return toPlainObject(source.returnRefund)
}

function hasReturnRefundRecord(record = {}) {
  return Boolean(
    cleanString(record.ticketId)
    || cleanString(record.status)
    || cleanString(record.requestType)
    || record.requestedAt
  )
}

function sanitizeReturnRefundItemsForOrder(items = []) {
  return (Array.isArray(items) ? items : [])
    .map(item => ({
      productId: isMongoObjectId(item.productId) ? item.productId : undefined,
      productQuery: cleanString(item.productQuery),
      name: cleanString(item.name || item.productQuery),
      quantity: Number.isFinite(Number(item.quantity)) && Number(item.quantity) > 0
        ? Math.floor(Number(item.quantity))
        : undefined,
      reason: cleanString(item.reason)
    }))
    .filter(item => item.productId || item.productQuery || item.name || item.quantity || item.reason)
}

async function saveReturnRefundRequestStatus(order, {
  result = {},
  requestType,
  preferredResolution,
  items = [],
  args = {},
  priority
} = {}) {
  const source = toPlainObject(order)
  const orderId = source._id?.toString?.() || source.id?.toString?.() || cleanString(source._id || source.id)
  if (!isMongoObjectId(orderId)) return null

  const document = typeof order?.save === 'function'
    ? order
    : await orderRepository.findOne({ _id: orderId, isDeleted: false })

  if (!document) return null

  const now = new Date()
  document.returnRefund = {
    requestType,
    preferredResolution,
    status: 'requested',
    refundStatus: ['refund', 'return_refund'].includes(requestType) ? 'requested' : 'not_applicable',
    exchangeStatus: requestType === 'exchange' ? 'requested' : 'not_applicable',
    ticketId: result.ticketId || result.request?.ticketId || '',
    reason: cleanString(args.reason),
    details: cleanString(args.details).slice(0, 1000),
    items: sanitizeReturnRefundItemsForOrder(items),
    requestedAt: now,
    updatedAt: now,
    source: 'chatbot_return_refund',
    priority: cleanString(priority)
  }

  await document.save()
  return toPlainObject(document.returnRefund)
}

function getReturnRefundRecordPayload(record = {}) {
  const status = normalizeReturnRefundStatus(record.status)
  const refundStatus = normalizeReturnRefundSubStatus(record.refundStatus)
  const exchangeStatus = normalizeReturnRefundSubStatus(record.exchangeStatus)

  return {
    ticketId: cleanString(record.ticketId) || null,
    requestType: cleanString(record.requestType) || null,
    requestTypeLabel: RETURN_REQUEST_TYPE_LABELS[record.requestType] || record.requestType || null,
    preferredResolution: cleanString(record.preferredResolution) || null,
    preferredResolutionLabel: RETURN_RESOLUTION_LABELS[record.preferredResolution] || record.preferredResolution || null,
    status,
    statusLabel: RETURN_REFUND_STATUS_LABELS[status] || status,
    refundStatus,
    refundStatusLabel: RETURN_REFUND_SUB_STATUS_LABELS[refundStatus] || refundStatus,
    exchangeStatus,
    exchangeStatusLabel: RETURN_REFUND_SUB_STATUS_LABELS[exchangeStatus] || exchangeStatus,
    reason: cleanString(record.reason) || null,
    items: Array.isArray(record.items) ? record.items.map(item => ({
      productId: item.productId?.toString?.() || cleanString(item.productId),
      productQuery: cleanString(item.productQuery) || null,
      name: cleanString(item.name) || null,
      quantity: Number.isFinite(Number(item.quantity)) ? Number(item.quantity) : null,
      reason: cleanString(item.reason) || null
    })) : [],
    requestedAt: record.requestedAt || null,
    updatedAt: record.updatedAt || null,
    resolvedAt: record.resolvedAt || null,
    priority: cleanString(record.priority) || null
  }
}

function buildNoReturnRefundRecordGuidance(order = {}) {
  const source = toPlainObject(order)

  if (source.status === 'pending') {
    return {
      suggestedTool: 'cancelOrder',
      message: 'Don hang dang cho xac nhan va chua co yeu cau doi tra/hoan tien nao duoc ghi nhan. Neu khach chi muon huy don pending, hay dung cancelOrder sau khi khach xac nhan.'
    }
  }

  if (source.status === 'cancelled' && source.paymentStatus !== 'paid') {
    return {
      suggestedTool: null,
      message: 'Don hang da huy va he thong chua ghi nhan thanh toan thanh cong, nen chua co trang thai hoan tien tren don nay.'
    }
  }

  return {
    suggestedTool: 'requestReturnOrRefund',
    message: 'Chua co yeu cau doi tra/hoan tien nao duoc ghi nhan tren don hang nay. Neu khach muon tao yeu cau moi, hay dung requestReturnOrRefund sau khi khach xac nhan.'
  }
}

function buildReturnRefundStatusPayload(order = {}, { verifiedBy = null, ticketId = '' } = {}) {
  const source = toPlainObject(order)
  const record = getReturnRefundRecord(source)
  const recordFound = hasReturnRefundRecord(record)
  const normalizedTicketId = cleanString(ticketId).toLowerCase()
  const storedTicketId = cleanString(record.ticketId).toLowerCase()
  const ticketMatched = normalizedTicketId ? storedTicketId === normalizedTicketId : null
  const orderSummary = buildOrderSummaryPayload(source)

  if (!recordFound) {
    const guidance = buildNoReturnRefundRecordGuidance(source)
    return {
      found: true,
      requestFound: false,
      statusAvailable: false,
      verifiedBy,
      ticketMatched,
      order: orderSummary,
      returnRefund: null,
      suggestedTool: guidance.suggestedTool,
      message: guidance.message
    }
  }

  const payload = getReturnRefundRecordPayload(record)
  const ticketMismatch = normalizedTicketId && !ticketMatched

  return {
    found: true,
    requestFound: !ticketMismatch,
    statusAvailable: !ticketMismatch,
    verifiedBy,
    ticketMatched,
    order: orderSummary,
    returnRefund: ticketMismatch ? null : payload,
    suggestedTool: ticketMismatch ? 'getRefundStatus' : null,
    message: ticketMismatch
      ? `Don ${orderSummary.code} co yeu cau doi tra/hoan tien da ghi nhan, nhung khong khop ma ticket khach cung cap. Vui long kiem tra lai ticketId hoac ma don.`
      : `Yeu cau ${payload.requestTypeLabel || 'doi tra/hoan tien'}${payload.ticketId ? ` ${payload.ticketId}` : ''} cua don ${orderSummary.code} dang o trang thai: ${payload.statusLabel}.`
  }
}

async function resolveRefundStatusOrder(args = {}, context = {}) {
  const userId = normalizeUserId(context)
  const orderLookup = cleanString(args.orderId || args.orderCode)
  const ticketId = cleanString(args.ticketId)

  if (isMongoObjectId(userId)) {
    if (ticketId && !orderLookup) {
      const order = await orderRepository.findOne({
        userId,
        isDeleted: false,
        'returnRefund.ticketId': { $regex: `^${escapeRegExp(ticketId)}$`, $options: 'i' }
      })

      if (order) return { order, verifiedBy: 'account_ticket' }
    }

    if (!orderLookup) {
      const result = await ordersService.getMyOrders(userId)
      const orders = Array.isArray(result?.orders) ? result.orders.slice(0, 5) : []

      return {
        error: {
          found: orders.length > 0,
          requiresOrderSelection: true,
          message: orders.length > 0
            ? 'Vui long chon ma don hang can kiem tra trang thai doi tra/hoan tien.'
            : 'Tai khoan dang chat chua co don hang nao de kiem tra.',
          orders: orders.map(buildOrderSummaryPayload)
        }
      }
    }

    const resolved = await resolveOwnOrderId(userId, {
      orderId: args.orderId,
      orderCode: args.orderCode
    })
    if (resolved.error) return { error: { found: false, ...resolved.error } }

    const order = await orderRepository.findOne({
      _id: resolved.orderId,
      userId,
      isDeleted: false
    })

    if (!order) {
      return {
        error: {
          found: false,
          message: 'Khong tim thay don hang trong tai khoan dang chat.'
        }
      }
    }

    return { order, verifiedBy: 'account' }
  }

  const phone = normalizePhone(args.phone || context.customerInfo?.phone)

  if (ticketId && phone && !orderLookup) {
    const order = await orderRepository.findOne({
      'returnRefund.ticketId': { $regex: `^${escapeRegExp(ticketId)}$`, $options: 'i' },
      'contact.phone': phone,
      isDeleted: false
    })

    if (order) return { order, verifiedBy: 'ticket_phone' }
  }

  if (!orderLookup) {
    return {
      error: {
        found: false,
        requiresLogin: true,
        requiresOrder: true,
        message: 'Khach can dang nhap hoac cung cap ma don hang va so dien thoai dat hang de kiem tra trang thai doi tra/hoan tien.'
      }
    }
  }

  if (!phone) {
    return {
      error: {
        found: false,
        requiresPhone: true,
        message: 'Vui long cung cap so dien thoai da dung khi dat hang de xac minh don hang.'
      }
    }
  }

  const query = {
    'contact.phone': phone,
    isDeleted: false
  }

  let order = null
  if (isMongoObjectId(orderLookup)) {
    order = await orderRepository.findOne({ ...query, _id: orderLookup })
  }

  if (!order) {
    order = await orderRepository.findOne({
      ...query,
      orderCode: { $regex: `^${escapeRegExp(orderLookup.replace(/^#/, ''))}$`, $options: 'i' }
    })
  }

  if (!order) {
    return {
      error: {
        found: false,
        message: 'Khong tim thay don hang khop voi ma don va so dien thoai.'
      }
    }
  }

  return { order, verifiedBy: 'order_code_phone' }
}

function buildReturnRequestMessage({
  args = {},
  order = {},
  requestType,
  preferredResolution,
  items = [],
  warnings = [],
  context = {}
} = {}) {
  const source = toPlainObject(order)
  const code = source.orderCode || formatOrderCode(source) || cleanString(args.orderCode || args.orderId)
  const orderItems = Array.isArray(source.orderItems) ? source.orderItems : []
  const selectedItems = items.length > 0
    ? items.map((item, index) => [
      `${index + 1}. ${item.name || item.productQuery || item.productId || 'San pham'}`,
      item.quantity ? `SL: ${item.quantity}` : null,
      item.reason ? `Ly do rieng: ${item.reason}` : null
    ].filter(Boolean).join(' | '))
    : ['Khach chua chi ro san pham; co the ap dung ca don hoac can nhan vien hoi them.']

  const orderItemPreview = orderItems.length > 0
    ? orderItems.slice(0, 8).map((item, index) =>
      `${index + 1}. ${item.name || 'San pham'} x${item.quantity || 1} - ${formatPrice(item.price ?? item.salePrice ?? 0)}`
    )
    : []

  return [
    `Loai yeu cau: ${RETURN_REQUEST_TYPE_LABELS[requestType] || requestType}`,
    `Huong xu ly mong muon: ${RETURN_RESOLUTION_LABELS[preferredResolution] || preferredResolution}`,
    `Ma don: ${code || '(khong co)'}`,
    `Trang thai don: ${source.status || '(khong ro)'} / thanh toan: ${source.paymentStatus || '(khong ro)'}`,
    source.total != null ? `Tong tien: ${formatPrice(source.total)}` : null,
    '',
    'San pham khach muon xu ly:',
    ...selectedItems,
    orderItemPreview.length > 0 ? '' : null,
    orderItemPreview.length > 0 ? 'San pham trong don (tham khao):' : null,
    ...orderItemPreview,
    '',
    `Ly do chinh: ${cleanString(args.reason)}`,
    cleanString(args.details) ? `Chi tiet: ${cleanString(args.details)}` : null,
    warnings.length > 0 ? `Can luu y: ${warnings.join(' | ')}` : null,
    cleanString(context.promptText) ? `Noi dung chat gan nhat: ${cleanString(context.promptText)}` : null
  ].filter(line => line !== null).join('\n')
}

async function getRefundStatus(args = {}, context = {}) {
  try {
    const resolved = await resolveRefundStatusOrder(args, context)
    if (resolved.error) return JSON.stringify(resolved.error)

    return JSON.stringify(buildReturnRefundStatusPayload(resolved.order, {
      verifiedBy: resolved.verifiedBy,
      ticketId: args.ticketId
    }))
  } catch (err) {
    logger.error('[AI Tool] getRefundStatus error:', err.message)
    return JSON.stringify({
      found: false,
      message: err.message || 'Khong the kiem tra trang thai doi tra/hoan tien.',
      error: 'Loi khi kiem tra trang thai doi tra/hoan tien.'
    })
  }
}

async function requestReturnOrRefund(args = {}, context = {}) {
  try {
    const reason = cleanString(args.reason)
    if (!reason) {
      return JSON.stringify({
        success: false,
        message: 'Vui long cung cap ly do doi tra/hoan tien truoc khi tao yeu cau.'
      })
    }

    const resolved = await resolveReturnRequestOrder(args, context)
    if (resolved.error) return JSON.stringify(resolved.error)

    const order = resolved.order || {}
    const requestType = normalizeReturnRequestType(args.requestType || args.type || context.promptText)
    const preferredResolution = normalizeReturnResolution(args.preferredResolution, requestType)
    const items = normalizeReturnRequestItems(args.items)
    const warnings = getReturnRequestWarnings(order, requestType)
    const contact = getReturnRequestContact(args, order, context)
    const orderSource = toPlainObject(order)
    const code = orderSource.orderCode || formatOrderCode(orderSource) || cleanString(args.orderCode || args.orderId)
    const priority = normalizeHandoffPriority(args.priority || (requestType === 'refund' ? 'high' : 'normal'))
    const subject = `[${RETURN_REQUEST_TYPE_LABELS[requestType] || 'Doi tra/hoan tien'}] Don ${code || 'khong ro'}`
    const message = buildReturnRequestMessage({
      args,
      order,
      requestType,
      preferredResolution,
      items,
      warnings,
      context
    })

    const contactService = require('../client/contact.service')
    const result = await contactService.submitContactRequest({
      ...contact,
      subject,
      message,
      priority,
      preferredContactMethod: contact.preferredContactMethod || 'chat',
      source: 'chatbot_return_refund'
    }, {
      ...context,
      source: 'chatbot_return_refund',
      userId: resolved.userId || context.userId || context.customerInfo?.userId || null
    })

    let savedReturnRefund = null
    try {
      savedReturnRefund = await saveReturnRefundRequestStatus(order, {
        result,
        requestType,
        preferredResolution,
        items,
        args,
        priority
      })
    } catch (saveErr) {
      logger.warn(`[AI Tool] requestReturnOrRefund status save failed: ${saveErr.message}`)
    }

    const latestOrderSource = toPlainObject(order)
    const escalationReason = truncateHandoffText(`Return/refund request ${result.ticketId}: ${subject}`, 500)

    return JSON.stringify({
      success: true,
      ticketCreated: true,
      returnRequestCreated: true,
      ticketId: result.ticketId,
      requestType,
      preferredResolution,
      verifiedBy: resolved.verifiedBy,
      warnings,
      order: latestOrderSource?._id || latestOrderSource?.id ? buildOrderSummaryPayload(latestOrderSource) : null,
      returnRefund: savedReturnRefund ? getReturnRefundRecordPayload(savedReturnRefund) : null,
      items,
      handoffRequested: true,
      escalate: true,
      escalationReason,
      reason: escalationReason,
      summary: subject,
      priority,
      message: `Minh da tao yeu cau ${RETURN_REQUEST_TYPE_LABELS[requestType] || 'doi tra/hoan tien'} ${result.ticketId}. Nhan vien se kiem tra don hang va phan hoi; day chua phai xac nhan phe duyet hoan tien.`,
      nextAction: 'support_follow_up'
    })
  } catch (err) {
    if (err.statusCode === 400) {
      logger.warn(`[AI Tool] requestReturnOrRefund validation: ${err.message}`)
      return JSON.stringify({
        success: false,
        requiresContactInfo: /email|so dien thoai|phone/i.test(err.message),
        message: err.message,
        error: 'RETURN_REFUND_REQUEST_VALIDATION_FAILED'
      })
    }

    logger.error('[AI Tool] requestReturnOrRefund error:', err.message)

    const fallbackReason = truncateHandoffText(
      `Return/refund request failed: ${cleanString(args.orderCode || args.orderId || context.promptText || 'Yeu cau doi tra/hoan tien')}`,
      500
    )

    return JSON.stringify({
      success: false,
      ticketCreated: false,
      returnRequestCreated: false,
      handoffRequested: true,
      escalate: true,
      escalationReason: fallbackReason,
      reason: fallbackReason,
      summary: cleanString(args.reason || context.promptText, 180) || null,
      priority: args.priority || 'high',
      message: 'Minh chua tao duoc ticket doi tra/hoan tien luc nay, nhung da chuyen thong tin sang nhan vien ho tro trong chat.',
      nextAction: 'notify_support_agents',
      error: 'RETURN_REFUND_REQUEST_FAILED'
    })
  }
}

const HANDOFF_PRIORITIES = ['low', 'normal', 'high', 'urgent']
const DEFAULT_HANDOFF_REASON = 'AI requested human support'
const HANDOFF_CUSTOMER_MESSAGE = 'Minh da chuyen cuoc tro chuyen sang nhan vien ho tro. Ban vui long doi trong giay lat nhe.'

function truncateHandoffText(value, maxLength) {
  const normalized = cleanString(value)
  return normalized.length > maxLength
    ? normalized.slice(0, maxLength).trim()
    : normalized
}

function normalizeHandoffPriority(priority) {
  const normalized = cleanString(priority).toLowerCase()
  return HANDOFF_PRIORITIES.includes(normalized) ? normalized : 'normal'
}

function buildHandoffReason({ reason, summary, priority } = {}, context = {}) {
  const normalizedPriority = normalizeHandoffPriority(priority)
  const baseReason = truncateHandoffText(reason, 280)
    || truncateHandoffText(context.promptText, 180)
    || DEFAULT_HANDOFF_REASON
  const normalizedSummary = truncateHandoffText(summary, 180)
  const reasonParts = [baseReason]

  if (normalizedSummary) {
    reasonParts.push(`Context: ${normalizedSummary}`)
  }

  if (normalizedPriority !== 'normal') {
    reasonParts.push(`Priority: ${normalizedPriority}`)
  }

  return {
    escalationReason: truncateHandoffText(reasonParts.join(' | '), 500),
    priority: normalizedPriority,
    summary: normalizedSummary || null
  }
}

function buildHandoffResponse(args = {}, context = {}) {
  const { escalationReason, priority, summary } = buildHandoffReason(args, context)

  return JSON.stringify({
    success: true,
    handoffRequested: true,
    escalate: true,
    escalationReason,
    reason: escalationReason,
    summary,
    priority,
    message: HANDOFF_CUSTOMER_MESSAGE,
    nextAction: 'notify_support_agents'
  })
}

async function handoffToHuman(args = {}, context = {}) {
  return buildHandoffResponse(args, context)
}

async function requestHumanAgent(args = {}, context = {}) {
  return buildHandoffResponse(args, context)
}

const toolExecutors = {
  searchProducts,
  getProductDetail,
  checkProductAvailability,
  compareProducts,
  checkOrderStatus,
  listMyOrders,
  getOrderDetail,
  getOrderInvoice,
  reorderPreviousOrder,
  trackOrderByCode,
  cancelOrder,
  updateOrderAddress,
  updateOrderContact,
  updatePendingOrderItems,
  checkPaymentStatus,
  resumePayment,
  getBankInfo,
  verifyBankTransfer,
  getFlashSales,
  getAvailablePromoCodes,
  getCouponWallet,
  checkPromoCode,
  getVipBenefits,
  getLoyaltyStatus,
  getCart,
  getCheckoutProfile,
  getDeliveryOptions,
  getUserProfile,
  requestPasswordReset,
  updateUserProfile,
  requestEmailChange,
  verifyEmailChange,
  requestAccountDeletion,
  getNotificationPreferences,
  addToCart,
  updateCartQuantity,
  removeFromCart,
  validateCart,
  applyPromoCodeToCart,
  removePromoCodeFromCart,
  updateCheckoutProfile,
  updateNotificationPreferences,
  placeOrder,
  clearCart,
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  toggleWishlist,
  clearWishlist,
  searchPolicies,
  getReturnPolicy,
  getPrivacyPolicy,
  getTermsOfService,
  getFAQ,
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
  voteReview,
  getStoreConfig,
  getSupportInfo,
  getStoreLocations,
  submitContactRequest,
  scheduleCallback,
  reportBugOrIssue,
  getRefundStatus,
  getWarrantyStatus,
  requestWarrantySupport,
  requestReturnOrRefund,
  createSupportTicket,
  requestPersonalDataExport,
  listMySupportTickets,
  getSupportTicketStatus,
  handoffToHuman,
  requestHumanAgent
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
