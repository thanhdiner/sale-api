/**
 * AI tool registry entries for account, privacy.
 * Keep executor implementation wiring in ../toolExecutor.js.
 */

module.exports = [
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
      name: 'listNotifications',
      label: 'Danh sach thong bao',
      description: 'Xem danh sach thong bao cua khach dang dang nhap, gom thong bao don hang, thanh toan, he thong va ho tro. Co the loc thong bao chua doc/da doc va danh muc.',
      group: 'account',
      riskLevel: 'safe',
      requiresConfirmation: false,
      defaultEnabled: true,
      endpoint: 'notificationService.listNotifications',
      parameters: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['all', 'read', 'unread'],
            description: 'Loc trang thai doc thong bao, mac dinh all.'
          },
          category: {
            type: 'string',
            enum: ['orders', 'payments', 'promotions', 'system', 'support', 'account', 'wishlist', 'reviews', 'chat'],
            description: 'Loc theo nhom thong bao neu khach yeu cau.'
          },
          limit: {
            type: 'number',
            description: 'So thong bao toi da can lay, mac dinh 10 va toi da 50.'
          },
          unreadOnly: {
            type: 'boolean',
            description: 'true neu chi muon xem thong bao chua doc.'
          }
        },
        required: []
      }
    },
  {
      name: 'markNotificationRead',
      label: 'Danh dau da doc thong bao',
      description: 'Danh dau mot, nhieu hoac tat ca thong bao cua khach dang dang nhap la da doc. Dung khi khach yeu cau danh dau thong bao da doc.',
      group: 'account',
      riskLevel: 'write',
      requiresConfirmation: false,
      defaultEnabled: true,
      endpoint: 'notificationService.markNotificationRead',
      parameters: {
        type: 'object',
        properties: {
          notificationId: {
            type: 'string',
            description: 'ID thong bao can danh dau da doc.'
          },
          notificationIds: {
            type: 'array',
            description: 'Danh sach ID thong bao can danh dau da doc.',
            items: { type: 'string' }
          },
          all: {
            type: 'boolean',
            description: 'true de danh dau tat ca thong bao chua doc la da doc.'
          }
        },
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
    }
]












