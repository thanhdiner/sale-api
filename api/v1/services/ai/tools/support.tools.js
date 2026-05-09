/**
 * AI tool registry entries for support.
 * Keep executor implementation wiring in ../toolExecutor.js.
 */

module.exports = [
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
      name: 'updateSupportTicket',
      label: 'Cap nhat support ticket',
      description: 'Bo sung thong tin, ghi chu, file dinh kem hoac noi dung moi vao ticket ho tro da tao qua chatbot. Tool nay tao mot follow-up request gan voi ticket goc va can xac minh bang tai khoan/phien chat/email/so dien thoai cua ticket.',
      group: 'support',
      riskLevel: 'write',
      requiresConfirmation: true,
      confirmationMessage: 'Hanh dong nay se bo sung thong tin/anh vao ticket ho tro da tao va gui cho nhan vien support. Ban co chac muon gui bo sung nay khong?',
      defaultEnabled: true,
      endpoint: 'contactService.addSupportTicketMessage',
      parameters: {
        type: 'object',
        properties: {
          ticketId: {
            type: 'string',
            description: 'Ma ticket goc can cap nhat, vi du CR-20260428-101530-ABCD.'
          },
          message: {
            type: 'string',
            description: 'Noi dung khach muon bo sung vao ticket.'
          },
          update: {
            type: 'string',
            description: 'Alias cua message, noi dung cap nhat ticket.'
          },
          attachmentUrls: {
            type: 'array',
            description: 'Danh sach URL anh/file/chung tu bo sung neu khach cung cap.',
            items: { type: 'string' }
          },
          email: {
            type: 'string',
            description: 'Email lien he cua ticket neu can xac minh hoac ticket goc khong co thong tin lien he.'
          },
          phone: {
            type: 'string',
            description: 'So dien thoai/Zalo lien he cua ticket neu can xac minh hoac ticket goc khong co thong tin lien he.'
          },
          name: {
            type: 'string',
            description: 'Ten khach hang neu khach cung cap.'
          },
          confirmed: {
            type: 'boolean',
            description: 'Phai la true sau khi khach da xac nhan ro rang muon bo sung thong tin/anh vao ticket.'
          },
          imageUrls: {
            type: 'array',
            description: 'Danh sach URL anh chup man hinh/anh minh chung khach gui kem.',
            items: { type: 'string' }
          }
        },
        required: ['confirmed', 'ticketId']
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
            enum: ['all', 'contact_request', 'support_ticket', 'ticket_update', 'callback', 'bug_report', 'return_refund', 'warranty', 'personal_data_export', 'account_deletion', 'payment_proof'],
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
      name: 'cancelSupportTicket',
      label: 'Huy yeu cau ho tro',
      description: 'Huy/danh dau da huy mot yeu cau ho tro hoac ticket da tao qua chatbot khi khach doi y. Can ma ticket va chi thuc hien khi ticket thuoc tai khoan/phien chat hien tai hoac khach xac minh bang email/so dien thoai.',
      group: 'support',
      riskLevel: 'write',
      requiresConfirmation: true,
      confirmationMessage: 'Hanh dong nay se ghi nhan huy yeu cau ho tro/ticket da tao qua chatbot. Ban co chac muon huy ticket nay khong?',
      defaultEnabled: true,
      endpoint: 'supportService.cancelSupportTicket',
      parameters: {
        type: 'object',
        properties: {
          confirmed: {
            type: 'boolean',
            description: 'Phai la true sau khi khach da xac nhan ro rang muon huy yeu cau ho tro/ticket.'
          },
          ticketId: {
            type: 'string',
            description: 'Ma ticket can huy, vi du CR-20260428-101530-ABCD.'
          },
          reason: {
            type: 'string',
            description: 'Ly do huy neu khach cung cap.'
          },
          email: {
            type: 'string',
            description: 'Email lien he cua ticket neu can xac minh.'
          },
          phone: {
            type: 'string',
            description: 'So dien thoai/Zalo lien he cua ticket neu can xac minh.'
          }
        },
        required: ['confirmed', 'ticketId']
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
      description: 'Tra trang thai ticket ho tro da tao/cap nhat tu createSupportTicket, addSupportTicketMessage, updateSupportTicket, reportBugOrIssue, requestWarrantySupport, requestReturnOrRefund, requestPersonalDataExport, requestAccountDeletion hoac submitPaymentProof theo ma ticket. Dung khi khach hoi ticket ho tro, bao loi, su co, bao hanh, doi tra, hoan tien, chung tu thanh toan, yeu cau xuat du lieu ca nhan hoac yeu cau xoa tai khoan dang o trang thai nao.',
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
      name: 'addSupportTicketMessage',
      label: 'Bo sung thong tin ticket',
      description: 'Bo sung noi dung, ghi chu, anh chup man hinh hoac tep/link dinh kem vao ticket ho tro da tao qua chatbot. Dung khi khach co ma ticket va muon gui them thong tin/anh cho nhan vien theo doi. Tool nay ghi them cap nhat vao ticket va gui cho support, nen can khach xac nhan ro rang.',
      group: 'support',
      riskLevel: 'write',
      requiresConfirmation: true,
      confirmationMessage: 'Hanh dong nay se bo sung thong tin/anh vao ticket ho tro da tao va gui cho nhan vien support. Ban co chac muon gui bo sung nay khong?',
      defaultEnabled: true,
      endpoint: 'contactService.addSupportTicketMessage',
      parameters: {
        type: 'object',
        properties: {
          confirmed: {
            type: 'boolean',
            description: 'Phai la true sau khi khach da xac nhan ro rang muon bo sung thong tin/anh vao ticket.'
          },
          ticketId: {
            type: 'string',
            description: 'Ma ticket da tao, vi du CR-20260428-101530-ABCD.'
          },
          message: {
            type: 'string',
            description: 'Noi dung/ghi chu bo sung khach muon gui cho support.'
          },
          details: {
            type: 'string',
            description: 'Alias cua message: chi tiet bo sung khach cung cap.'
          },
          note: {
            type: 'string',
            description: 'Ghi chu ngan bo sung vao ticket.'
          },
          imageUrls: {
            type: 'array',
            description: 'Danh sach URL anh chup man hinh/anh minh chung khach gui kem.',
            items: { type: 'string' }
          },
          screenshotUrls: {
            type: 'array',
            description: 'Alias cua imageUrls cho anh chup man hinh.',
            items: { type: 'string' }
          },
          attachmentUrls: {
            type: 'array',
            description: 'Danh sach URL tep/link dinh kem khac neu co.',
            items: { type: 'string' }
          },
          email: {
            type: 'string',
            description: 'Email lien he cua ticket neu can xac minh quyen bo sung.'
          },
          phone: {
            type: 'string',
            description: 'So dien thoai/Zalo lien he cua ticket neu can xac minh quyen bo sung.'
          }
        },
        required: ['confirmed', 'ticketId']
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












