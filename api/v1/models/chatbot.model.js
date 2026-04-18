const mongoose = require('mongoose')

const chatbotConfigSchema = new mongoose.Schema(
  {
    // Cấu hình chung
    isEnabled: { type: Boolean, default: true },
    aiProvider: { type: String, enum: ['openai', 'deepseek', 'groq'], default: 'openai' },
    model: { type: String, default: 'gpt-4o-mini' },
    maxTokens: { type: Number, default: 1000 },
    temperature: { type: Number, default: 0.7 },

    // Giọng thương hiệu
    brandVoice: { type: String, default: '' },
    systemPromptOverride: { type: String, default: '' },

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

    // Cập nhật bởi
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminAccount' }
  },
  { timestamps: true }
)

module.exports = mongoose.model('ChatbotConfig', chatbotConfigSchema, 'chatbotConfigs')
