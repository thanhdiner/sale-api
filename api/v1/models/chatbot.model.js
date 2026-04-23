const mongoose = require('mongoose')

const chatbotConfigSchema = new mongoose.Schema(
  {
    // Thong tin agent
    agentName: { type: String, default: 'Trợ lý mua hàng' },
    agentRole: {
      type: String,
      default: 'Hỗ trợ tìm sản phẩm, tư vấn, tra cứu khuyến mãi và đơn hàng'
    },
    agentTone: { type: String, default: 'Thân thiện, ngắn gọn, rõ ràng' },

    // Cau hinh chung
    isEnabled: { type: Boolean, default: true },
    aiProvider: { type: String, enum: ['openai', 'deepseek', 'groq', '9router'], default: 'openai' },
    model: { type: String, default: 'gpt-4o-mini' },
    maxTokens: { type: Number, default: 1000 },
    temperature: { type: Number, default: 0.7 },

    // Prompt va quy tac
    brandVoice: { type: String, default: '' },
    systemPromptOverride: { type: String, default: '' },
    systemRules: {
      type: [String],
      default: [
        'Không tự tạo đơn hàng khi khách chưa xác nhận.',
        'Không tự sửa địa chỉ giao hàng nếu khách chưa xác nhận.',
        'Luôn lấy giá và tồn kho từ dữ liệu hệ thống.',
        'Nếu không chắc chắn, nói rõ giới hạn và đề nghị chuyển nhân viên.'
      ]
    },

    // Fallback
    fallbackMessage: {
      type: String,
      default: 'Xin lỗi, mình chưa hiểu rõ. Để mình chuyển bạn đến nhân viên hỗ trợ nhé!'
    },
    autoEscalateKeywords: {
      type: [String],
      default: ['khiếu nại', 'hoàn tiền', 'gặp nhân viên', 'hủy đơn']
    },

    // Rate limit
    maxMessagesPerMinute: { type: Number, default: 10 },
    maxMessagesPerSession: { type: Number, default: 100 },

    // Tools built-in duoc phep dung
    toolSettings: {
      type: [
        {
          name: { type: String, required: true },
          enabled: { type: Boolean, default: true }
        }
      ],
      default: []
    },

    // Cap nhat boi
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminAccount' }
  },
  { timestamps: true }
)

module.exports = mongoose.model('ChatbotConfig', chatbotConfigSchema, 'chatbotConfigs')
