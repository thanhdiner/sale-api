const DEFAULT_FALLBACK_MESSAGE = process.env.CHATBOT_FALLBACK_MESSAGE
  || 'Xin lỗi, mình gặp chút trục trặc. Để mình chuyển bạn đến nhân viên hỗ trợ nhé!'

const PROCESS_FALLBACK_MESSAGE = process.env.CHATBOT_FALLBACK_MESSAGE
  || 'Xin lỗi, mình gặp chút trục trặc. Để mình chuyển bạn đến nhân viên hỗ trợ nhé! 🙏'

const DEFAULT_ESCALATE_KEYWORDS = [
  'gặp nhân viên', 'nói chuyện với người', 'chuyển nhân viên',
  'hotline', 'khiếu nại', 'kiện', 'tố cáo'
]

const DEFAULT_SYSTEM_RULES = [
  'Không tự tạo đơn hàng khi khách chưa xác nhận.',
  'Không tự sửa địa chỉ giao hàng nếu khách chưa xác nhận.',
  'Luôn lấy giá và tồn kho từ dữ liệu hệ thống.',
  'Nếu không chắc chắn, nói rõ giới hạn và đề nghị chuyển nhân viên.'
]

const PROVIDERS = {
  openai: {
    baseURL: 'https://api.openai.com/v1',
    envKey: 'OPENAI_API_KEY',
    defaultModel: 'gpt-4o-mini'
  },
  deepseek: {
    baseURL: 'https://api.deepseek.com',
    envKey: 'DEEPSEEK_API_KEY',
    defaultModel: 'deepseek-chat'
  },
  groq: {
    baseURL: 'https://api.groq.com/openai/v1',
    envKey: 'GROQ_API_KEY',
    defaultModel: 'llama-3.3-70b-versatile'
  },
  '9router': {
    baseURL: 'http://localhost:20128/v1',
    envKey: 'NINEROUTER_API_KEY',
    defaultApiKey: 'sk_9router',
    apiKeyOptional: true
  }
}

const MAX_TOOL_ROUNDS = 3

module.exports = {
  DEFAULT_FALLBACK_MESSAGE,
  PROCESS_FALLBACK_MESSAGE,
  DEFAULT_ESCALATE_KEYWORDS,
  DEFAULT_SYSTEM_RULES,
  PROVIDERS,
  MAX_TOOL_ROUNDS
}











