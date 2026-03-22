const swaggerJsdoc = require('swagger-jsdoc')

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: '🛒 SmartMall API',
      version: '1.0.0',
      description: `
## SmartMall REST API Documentation

Đây là tài liệu API cho hệ thống SmartMall — nền tảng thương mại điện tử.

### Authentication
- **Client routes** dùng Bearer JWT token: \`Authorization: Bearer <token>\`
- **Admin routes** dùng Bearer JWT token riêng biệt

### Base URLs
- **Client API**: \`/api/v1\`
- **Admin API**: \`/api/v1/admin\`
      `,
      contact: {
        name: 'SmartMall Team',
        email: 'smartmall.business.official@gmail.com'
      },
      license: { name: 'ISC' }
    },
    servers: [
      {
        url: process.env.SERVER_URL || 'http://localhost:3001',
        description: 'Development Server'
      }
    ],
    components: {
      securitySchemes: {
        clientAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Client JWT token (từ /api/v1/user/login)'
        },
        adminAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Admin JWT token (từ /api/v1/admin/auth/login)'
        }
      },
      schemas: {
        // ─── Common ───────────────────────────────────────────────────────────
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string', example: 'Lỗi xảy ra' }
          }
        },
        Success: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Thành công' }
          }
        },
        // ─── User ─────────────────────────────────────────────────────────────
        User: {
          type: 'object',
          properties: {
            _id: { type: 'string', example: '65f1a2b3c4d5e6f7a8b9c0d1' },
            username: { type: 'string', example: 'nguyenvana' },
            email: { type: 'string', example: 'user@example.com' },
            fullName: { type: 'string', example: 'Nguyễn Văn A' },
            phone: { type: 'string', example: '0901234567' },
            avatarUrl: { type: 'string', example: 'https://...' },
            status: { type: 'string', enum: ['active', 'inactive', 'banned'] },
            createdAt: { type: 'string', format: 'date-time' }
          }
        },
        // ─── Product ──────────────────────────────────────────────────────────
        Product: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            title: { type: 'string', example: 'iPhone 15 Pro' },
            slug: { type: 'string', example: 'iphone-15-pro' },
            price: { type: 'number', example: 25000000 },
            originalPrice: { type: 'number', example: 27000000 },
            discountPercent: { type: 'number', example: 7 },
            stock: { type: 'integer', example: 100 },
            sold: { type: 'integer', example: 50 },
            thumbnail: { type: 'string' },
            images: { type: 'array', items: { type: 'string' } },
            description: { type: 'string' },
            category: { type: 'string', example: 'Điện thoại' },
            status: { type: 'string', enum: ['active', 'inactive'] },
            avgRating: { type: 'number', example: 4.5 },
            reviewCount: { type: 'integer', example: 120 }
          }
        },
        // ─── Cart ─────────────────────────────────────────────────────────────
        CartItem: {
          type: 'object',
          properties: {
            productId: { type: 'string' },
            name: { type: 'string' },
            image: { type: 'string' },
            price: { type: 'number' },
            originalPrice: { type: 'number' },
            quantity: { type: 'integer' },
            stock: { type: 'integer' },
            inStock: { type: 'boolean' }
          }
        },
        // ─── Order ────────────────────────────────────────────────────────────
        OrderContact: {
          type: 'object',
          required: ['firstName', 'lastName', 'phone'],
          properties: {
            firstName: { type: 'string', example: 'Văn A' },
            lastName: { type: 'string', example: 'Nguyễn' },
            phone: { type: 'string', example: '0901234567' },
            email: { type: 'string', example: 'user@example.com' },
            notes: { type: 'string', example: 'Giao giờ hành chính' }
          }
        },
        Order: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            userId: { type: 'string' },
            contact: { $ref: '#/components/schemas/OrderContact' },
            orderItems: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  productId: { type: 'string' },
                  name: { type: 'string' },
                  image: { type: 'string' },
                  price: { type: 'number' },
                  quantity: { type: 'integer' }
                }
              }
            },
            subtotal: { type: 'number' },
            discount: { type: 'number' },
            shipping: { type: 'number' },
            total: { type: 'number' },
            paymentMethod: {
              type: 'string',
              enum: ['transfer', 'contact', 'vnpay', 'momo', 'zalopay']
            },
            paymentStatus: { type: 'string', enum: ['pending', 'paid', 'failed'] },
            status: {
              type: 'string',
              enum: ['pending', 'confirmed', 'shipping', 'completed', 'cancelled']
            },
            createdAt: { type: 'string', format: 'date-time' }
          }
        },
        // ─── Review ───────────────────────────────────────────────────────────
        Review: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            productId: { type: 'string' },
            userId: { $ref: '#/components/schemas/User' },
            rating: { type: 'integer', minimum: 1, maximum: 5 },
            title: { type: 'string' },
            content: { type: 'string' },
            images: { type: 'array', items: { type: 'string' } },
            videos: { type: 'array', items: { type: 'string' } },
            helpfulCount: { type: 'integer' },
            isVoted: { type: 'boolean' },
            isOwner: { type: 'boolean' },
            sellerReply: {
              type: 'object',
              properties: {
                content: { type: 'string' },
                repliedAt: { type: 'string', format: 'date-time' }
              }
            },
            createdAt: { type: 'string', format: 'date-time' }
          }
        },
        // ─── Pagination ───────────────────────────────────────────────────────
        Pagination: {
          type: 'object',
          properties: {
            page: { type: 'integer', example: 1 },
            limit: { type: 'integer', example: 12 },
            total: { type: 'integer', example: 100 },
            totalPages: { type: 'integer', example: 9 }
          }
        },
        // ─── AdminAccount ─────────────────────────────────────────────────────
        AdminAccount: {
          type: 'object',
          properties: {
            _id: { type: 'string', example: '65f1a2b3c4d5e6f7a8b9c0d1' },
            username: { type: 'string', example: 'admin01' },
            email: { type: 'string', example: 'admin@smartmall.vn' },
            fullName: { type: 'string', example: 'Nguyễn Admin' },
            avatarUrl: { type: 'string' },
            role_id: {
              type: 'object',
              properties: {
                _id: { type: 'string' },
                label: { type: 'string', example: 'Editor' },
                permissions: { type: 'array', items: { type: 'string' } }
              }
            },
            status: { type: 'string', enum: ['active', 'inactive', 'banned'] },
            twoFAEnabled: { type: 'boolean' },
            lastLogin: { type: 'string', format: 'date-time' },
            createdAt: { type: 'string', format: 'date-time' }
          }
        }
      }
    },
    tags: [
      { name: 'Health', description: 'Server health check' },
      { name: 'Auth (Client)', description: 'Đăng ký / Đăng nhập client' },
      { name: 'User', description: 'Quản lý tài khoản người dùng' },
      { name: 'Products', description: 'Sản phẩm (public)' },
      { name: 'Product Categories', description: 'Danh mục sản phẩm (public)' },
      { name: 'Cart', description: 'Giỏ hàng (cần đăng nhập)' },
      { name: 'Orders', description: 'Đơn hàng (cần đăng nhập)' },
      { name: 'Reviews', description: 'Đánh giá sản phẩm' },
      { name: 'Payment', description: 'Thanh toán: VNPay, MoMo, ZaloPay' },
      { name: 'Promo Codes', description: 'Mã khuyến mãi' },
      { name: 'Flash Sales', description: 'Flash sale (public)' },
      { name: 'Banners', description: 'Banner quảng cáo (public)' },
      { name: 'Widgets', description: 'Widget nội dung (public)' },
      { name: 'Bank Info', description: 'Thông tin ngân hàng' },
      { name: 'Contact', description: 'Liên hệ / Gửi email' },
      { name: 'Admin — Auth', description: '🔐 Đăng nhập Admin' },
      { name: 'Admin — Dashboard', description: '📊 Dashboard & thống kê' },
      { name: 'Admin — Products', description: '📦 Quản lý sản phẩm' },
      { name: 'Admin — Categories', description: '🗂 Quản lý danh mục' },
      { name: 'Admin — Orders', description: '🛒 Quản lý đơn hàng' },
      { name: 'Admin — Accounts', description: '👤 Quản lý tài khoản admin' },
      { name: 'Admin — Roles', description: '🔑 Quản lý vai trò' },
      { name: 'Admin — Permissions', description: '🛡 Quản lý quyền' },
      { name: 'Admin — Reviews', description: '⭐ Quản lý đánh giá' },
      { name: 'Admin — Promo Codes', description: '🎟 Quản lý mã giảm giá' },
      { name: 'Admin — Banners', description: '🖼 Quản lý banner' },
      { name: 'Admin — Widgets', description: '🧩 Quản lý widget' },
      { name: 'Admin — Flash Sales', description: '⚡ Quản lý flash sale' },
      { name: 'Admin — Settings', description: '⚙️ Cài đặt website' },
      { name: 'Admin — Bank Info', description: '🏦 Thông tin ngân hàng' }
    ]
  },
  // Point to all JSDoc files with @swagger annotations
  apis: [
    './api/v1/docs/*.yaml',
    './api/v1/docs/*.js'
  ]
}

const swaggerSpec = swaggerJsdoc(options)

module.exports = swaggerSpec
