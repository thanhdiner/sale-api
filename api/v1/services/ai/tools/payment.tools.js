/**
 * AI tool registry entries for payments.
 * Keep executor implementation wiring in ../toolExecutor.js.
 */

module.exports = [
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
      name: 'updatePendingOrderPaymentMethod',
      label: 'Doi cong thanh toan don pending',
      description: 'Doi cong thanh toan cho don pending chua thanh toan cua khach dang dang nhap. Dung khi khach muon doi tu VNPay sang MoMo/ZaloPay/Sepay hoac nguoc lai. Can khach xac nhan ro rang truoc khi thuc thi va tra ve link/thong tin thanh toan moi.',
      group: 'payments',
      riskLevel: 'write',
      requiresConfirmation: true,
      confirmationMessage: 'Hanh dong nay se doi cong thanh toan cua don pending va tao thong tin thanh toan moi. Ban co chac muon doi cong thanh toan khong?',
      defaultEnabled: true,
      endpoint: 'orderService.updatePendingOrderPaymentMethod',
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
            description: 'Cong thanh toan moi khach muon dung. card se duoc hieu la vnpay.'
          },
          confirmed: {
            type: 'boolean',
            description: 'Phai la true sau khi khach da xac nhan ro rang muon doi cong thanh toan cua don pending.'
          }
        },
        required: ['paymentMethod', 'confirmed']
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
      name: 'submitPaymentProof',
      label: 'Gui chung tu thanh toan',
      description: 'Tao ticket gui bien lai/chung tu chuyen khoan de nhan vien doi soat thu cong khi auto verify/Sepay chua khop. Dung khi khach da chuyen khoan va gui anh bien lai, ma giao dich, so tien, thoi gian chuyen khoan hoac thong tin ngan hang. Tool nay khong tu xac nhan thanh toan va khong doi paymentStatus.',
      group: 'payments',
      riskLevel: 'write',
      requiresConfirmation: false,
      defaultEnabled: true,
      endpoint: 'paymentService.submitPaymentProof',
      parameters: {
        type: 'object',
        properties: {
          orderId: {
            type: 'string',
            description: 'MongoDB ObjectId cua don hang neu co.'
          },
          orderCode: {
            type: 'string',
            description: 'Ma don hang/orderCode khach cung cap.'
          },
          paymentReference: {
            type: 'string',
            description: 'Noi dung chuyen khoan/paymentReference khach da nhap khi chuyen tien.'
          },
          phone: {
            type: 'string',
            description: 'So dien thoai dat hang, can cho khach chua dang nhap de xac minh don.'
          },
          email: {
            type: 'string',
            description: 'Email lien he/dat hang neu khach chua dang nhap hoac muon nhan phan hoi qua email.'
          },
          proofImageUrls: {
            type: 'array',
            description: 'Danh sach URL anh bien lai/chung tu khach da upload/gui trong chat.',
            items: { type: 'string' },
            maxItems: 10
          },
          proofUrl: {
            type: 'string',
            description: 'URL chung tu neu chi co mot link.'
          },
          transactionId: {
            type: 'string',
            description: 'Ma giao dich/reference tren bien lai neu khach cung cap.'
          },
          paidAmount: {
            type: 'number',
            description: 'So tien khach da chuyen theo bien lai.'
          },
          transferTime: {
            type: 'string',
            description: 'Thoi gian chuyen khoan theo bien lai neu co.'
          },
          senderBank: {
            type: 'string',
            description: 'Ngan hang nguoi chuyen neu co.'
          },
          senderAccount: {
            type: 'string',
            description: 'So tai khoan hoac ten tai khoan nguoi chuyen neu co.'
          },
          note: {
            type: 'string',
            description: 'Ghi chu bo sung cua khach ve giao dich/chung tu.'
          }
        },
        required: []
      }
    }
]












