/**
 * AI tool registry entries for orders, checkout.
 * Keep executor implementation wiring in ../toolExecutor.js.
 */

module.exports = [
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
      name: 'resendOrderConfirmation',
      label: 'Gui lai email xac nhan don',
      description: 'Gui lai email xac nhan don hang cho khach dang dang nhap va so huu don. Chi gui ve email lien he cua don hoac email tai khoan; khong cho phep nhap email tuy y.',
      group: 'orders',
      riskLevel: 'write',
      requiresConfirmation: true,
      confirmationMessage: 'Hanh dong nay se gui lai email xac nhan don hang den email lien he cua don hoac email tai khoan. Ban co chac muon gui lai khong?',
      defaultEnabled: true,
      endpoint: 'orderService.resendOrderConfirmation',
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
          confirmed: {
            type: 'boolean',
            description: 'Phai la true sau khi khach da xac nhan ro rang muon gui lai email xac nhan don.'
          }
        },
        required: ['confirmed']
      }
    },
  {
      name: 'resendDigitalDelivery',
      label: 'Gui lai thong tin ban giao so',
      description: 'Gui lai email thong tin ban giao so/tai khoan/license cua don da thanh toan cho khach dang dang nhap va so huu don. Khong hien thi username, mat khau, license hay link dang nhap trong chat.',
      group: 'orders',
      riskLevel: 'write',
      requiresConfirmation: true,
      confirmationMessage: 'Hanh dong nay se gui lai thong tin ban giao so cua don hang qua email. Vi bao mat, chatbot se khong hien thi tai khoan, mat khau hay license trong chat. Ban co chac muon gui lai khong?',
      defaultEnabled: true,
      endpoint: 'orderService.resendDigitalDelivery',
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
          confirmed: {
            type: 'boolean',
            description: 'Phai la true sau khi khach da xac nhan ro rang muon gui lai thong tin ban giao so qua email.'
          }
        },
        required: ['confirmed']
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
      name: 'applyPromoCodeToPendingOrder',
      label: 'Ap ma giam gia don pending',
      description: 'Ap hoac thay ma giam gia cho don pending chua thanh toan cua khach dang dang nhap. Tool nay cap nhat tong tien va tra ve link/thong tin thanh toan moi, can khach xac nhan ro rang truoc khi thuc thi.',
      group: 'orders',
      riskLevel: 'write',
      requiresConfirmation: true,
      confirmationMessage: 'Hanh dong nay se ap ma giam gia va cap nhat tong tien cua don pending. Ban co chac muon ap ma nay khong?',
      defaultEnabled: true,
      endpoint: 'orderService.applyPromoCodeToPendingOrder',
      parameters: {
        type: 'object',
        properties: {
          orderId: {
            type: 'string',
            description: 'MongoDB ObjectId cua don pending can ap ma, neu co.'
          },
          orderCode: {
            type: 'string',
            description: 'Ma don hang/orderCode hoac ma hien thi khach cung cap.'
          },
          code: {
            type: 'string',
            description: 'Ma giam gia can ap vao don pending.'
          },
          promoCode: {
            type: 'string',
            description: 'Alias cua code, ma giam gia can ap vao don pending.'
          },
          confirmed: {
            type: 'boolean',
            description: 'Phai la true sau khi khach da xac nhan ro rang muon ap ma giam gia vao don pending.'
          }
        },
        required: ['confirmed']
      }
    },
  {
      name: 'removePromoCodeFromPendingOrder',
      label: 'Go ma giam gia don pending',
      description: 'Go ma giam gia khoi don pending chua thanh toan cua khach dang dang nhap. Tool nay cap nhat tong tien va tra ve link/thong tin thanh toan moi, can khach xac nhan ro rang truoc khi thuc thi.',
      group: 'orders',
      riskLevel: 'write',
      requiresConfirmation: true,
      confirmationMessage: 'Hanh dong nay se go ma giam gia va cap nhat tong tien cua don pending. Ban co chac muon go ma khong?',
      defaultEnabled: true,
      endpoint: 'orderService.removePromoCodeFromPendingOrder',
      parameters: {
        type: 'object',
        properties: {
          orderId: {
            type: 'string',
            description: 'MongoDB ObjectId cua don pending can go ma, neu co.'
          },
          orderCode: {
            type: 'string',
            description: 'Ma don hang/orderCode hoac ma hien thi khach cung cap.'
          },
          code: {
            type: 'string',
            description: 'Ma giam gia khach nhac den, neu co. Neu bo trong se go ma dang ap tren don.'
          },
          promoCode: {
            type: 'string',
            description: 'Alias cua code.'
          },
          confirmed: {
            type: 'boolean',
            description: 'Phai la true sau khi khach da xac nhan ro rang muon go ma giam gia khoi don pending.'
          }
        },
        required: ['confirmed']
      }
    },
  {
      name: 'updatePendingOrderDeliveryMethod',
      label: 'Doi phuong thuc nhan/giao don pending',
      description: 'Doi phuong thuc nhan/giao cho don pending chua thanh toan cua khach dang dang nhap va tinh lai phi giao/ban giao, tong tien, thong tin thanh toan moi. Chi goi sau khi khach xac nhan ro rang.',
      group: 'orders',
      riskLevel: 'write',
      requiresConfirmation: true,
      confirmationMessage: 'Hanh dong nay se doi phuong thuc nhan/giao va cap nhat phi cung tong tien cua don pending. Ban co chac muon luu thay doi nay khong?',
      defaultEnabled: true,
      endpoint: 'orderService.updatePendingOrderDeliveryMethod',
      parameters: {
        type: 'object',
        properties: {
          orderId: {
            type: 'string',
            description: 'MongoDB ObjectId cua don pending can doi phuong thuc nhan/giao, neu co.'
          },
          orderCode: {
            type: 'string',
            description: 'Ma don hang/orderCode hoac ma hien thi khach cung cap.'
          },
          deliveryMethod: {
            type: 'string',
            enum: ['pickup', 'contact'],
            description: 'Phuong thuc moi: pickup=nhan/ban giao truc tiep, contact=lien he de thoa thuan giao/ban giao.'
          },
          shipping: {
            type: 'number',
            description: 'Phi giao/ban giao da chot neu co. Bo trong de he thong tinh lai: pickup=0, contact theo nguong mien phi/mac dinh.'
          },
          confirmed: {
            type: 'boolean',
            description: 'Phai la true sau khi khach da xac nhan ro rang muon doi phuong thuc nhan/giao.'
          }
        },
        required: ['deliveryMethod', 'confirmed']
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
    }
]












