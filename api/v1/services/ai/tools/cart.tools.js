/**
 * AI tool registry entries for cart, wishlist.
 * Keep executor implementation wiring in ../toolExecutor.js.
 */

module.exports = [
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
    }
]
