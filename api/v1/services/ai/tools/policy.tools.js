/**
 * AI tool registry entries for policies.
 * Keep executor implementation wiring in ../toolExecutor.js.
 */

module.exports = [
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
    }
]












