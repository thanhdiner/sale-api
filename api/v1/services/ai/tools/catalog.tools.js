/**
 * AI tool registry entries for catalog, promotions, membership, content, reviews.
 * Keep executor implementation wiring in ../toolExecutor.js.
 */

module.exports = [
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
      name: 'getProductAlternatives',
      label: 'Goi y san pham thay the',
      description: 'Goi y san pham thay the dang con hang khi san pham goc het hang, khong du so luong hoac vuot ngan sach cua khach. Uu tien san pham cung danh muc, trong ngan sach va con du ton kho.',
      group: 'catalog',
      riskLevel: 'safe',
      requiresConfirmation: false,
      defaultEnabled: true,
      endpoint: 'productService.getProductAlternatives',
      parameters: {
        type: 'object',
        properties: {
          productId: {
            type: 'string',
            description: 'MongoDB ObjectId cua san pham goc can tim thay the, neu co.'
          },
          productQuery: {
            type: 'string',
            description: 'Ten hoac slug san pham goc can tim thay the neu chua co productId.'
          },
          budget: {
            type: 'number',
            description: 'Ngan sach toi da cua khach cho moi san pham, tinh theo VND.'
          },
          maxPrice: {
            type: 'number',
            description: 'Alias cua budget: gia toi da sau giam.'
          },
          quantity: {
            type: 'number',
            description: 'So luong khach muon mua de loc san pham co du ton kho, mac dinh 1.'
          },
          category: {
            type: 'string',
            description: 'Danh muc muon uu tien neu khach noi ro. Neu bo trong se uu tien danh muc cua san pham goc.'
          },
          reason: {
            type: 'string',
            enum: ['out_of_stock', 'over_budget', 'insufficient_stock', 'general'],
            description: 'Ly do can goi y thay the neu biet ro.'
          },
          limit: {
            type: 'number',
            description: 'So san pham thay the toi da, mac dinh 5 va toi da 10.'
          }
        },
        required: []
      }
    },
  {
      name: 'subscribeBackInStock',
      label: 'Dang ky bao co hang',
      description: 'Dang ky nhan email khi san pham dang het hang co hang tro lai. Dung khi khach muon bao khi co hang, nhac toi khi hang ve, dang ky back-in-stock cho san pham. Co the dung productId/productQuery hoac san pham khach dang xem; neu khach chua dang nhap thi can email.',
      group: 'catalog',
      riskLevel: 'write',
      requiresConfirmation: false,
      defaultEnabled: true,
      endpoint: 'backInStockService.registerBackInStockNotification',
      parameters: {
        type: 'object',
        properties: {
          productId: {
            type: 'string',
            description: 'MongoDB ObjectId cua san pham can dang ky bao co hang.'
          },
          productQuery: {
            type: 'string',
            description: 'Ten hoac slug san pham neu chua co productId.'
          },
          email: {
            type: 'string',
            description: 'Email nhan thong bao. Co the bo trong neu khach da dang nhap va tai khoan co email.'
          },
          language: {
            type: 'string',
            enum: ['vi', 'en'],
            description: 'Ngon ngu thong bao, mac dinh theo phien chat.'
          }
        },
        required: []
      }
    },
  {
      name: 'unsubscribeBackInStock',
      label: 'Huy bao co hang',
      description: 'Huy dang ky nhan email khi san pham co hang tro lai. Dung khi khach muon huy bao hang ve/huy back-in-stock cho san pham. Co the dung productId/productQuery hoac san pham khach dang xem; neu khach chua dang nhap thi can email da dang ky.',
      group: 'catalog',
      riskLevel: 'write',
      requiresConfirmation: false,
      defaultEnabled: true,
      endpoint: 'backInStockService.unregisterBackInStockNotification',
      parameters: {
        type: 'object',
        properties: {
          productId: {
            type: 'string',
            description: 'MongoDB ObjectId cua san pham can huy dang ky bao co hang.'
          },
          productQuery: {
            type: 'string',
            description: 'Ten hoac slug san pham neu chua co productId.'
          },
          email: {
            type: 'string',
            description: 'Email da dang ky. Co the bo trong neu khach da dang nhap va tai khoan co email.'
          },
          language: {
            type: 'string',
            enum: ['vi', 'en'],
            description: 'Ngon ngu thong bao, mac dinh theo phien chat.'
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
    }
]












