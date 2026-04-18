const ChatbotConfig = require('../../models/chatbot.model')
const logger = require('../../../../config/logger')

// GET /api/v1/admin/chatbot-config
exports.getConfig = async (req, res) => {
  try {
    let config = await ChatbotConfig.findOne().lean()
    if (!config) {
      // Tạo config mặc định nếu chưa có
      config = await ChatbotConfig.create({})
      config = config.toObject()
    }

    // Thêm thông tin từ env (không lưu API key vào DB)
    config.envProvider = process.env.CHATBOT_PROVIDER || 'openai'
    config.envModel = process.env.CHATBOT_MODEL || 'gpt-4o-mini'
    config.envEnabled = process.env.CHATBOT_ENABLED !== 'false'
    config.hasOpenaiKey = !!(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'sk-your-openai-key-here')
    config.hasDeepseekKey = !!(process.env.DEEPSEEK_API_KEY && process.env.DEEPSEEK_API_KEY !== 'sk-your-deepseek-key-here')
    config.hasGroqKey = !!(process.env.GROQ_API_KEY && process.env.GROQ_API_KEY !== 'gsk-your-groq-key-here')

    res.json({ success: true, data: config })
  } catch (err) {
    logger.error('[Admin] Get chatbot config error:', err.message)
    res.status(500).json({ success: false, message: 'Lỗi server' })
  }
}

// PATCH /api/v1/admin/chatbot-config
exports.updateConfig = async (req, res) => {
  try {
    const {
      isEnabled,
      aiProvider,
      model,
      maxTokens,
      temperature,
      brandVoice,
      systemPromptOverride,
      fallbackMessage,
      autoEscalateKeywords,
      maxMessagesPerMinute,
      maxMessagesPerSession
    } = req.body

    let config = await ChatbotConfig.findOne()
    if (!config) {
      config = new ChatbotConfig()
    }

    // Cập nhật từng field nếu có gửi lên
    if (isEnabled !== undefined) config.isEnabled = isEnabled
    if (aiProvider) config.aiProvider = aiProvider
    if (model) config.model = model
    if (maxTokens) config.maxTokens = maxTokens
    if (temperature !== undefined) config.temperature = temperature
    if (brandVoice !== undefined) config.brandVoice = brandVoice
    if (systemPromptOverride !== undefined) config.systemPromptOverride = systemPromptOverride
    if (fallbackMessage !== undefined) config.fallbackMessage = fallbackMessage
    if (autoEscalateKeywords) config.autoEscalateKeywords = autoEscalateKeywords
    if (maxMessagesPerMinute) config.maxMessagesPerMinute = maxMessagesPerMinute
    if (maxMessagesPerSession) config.maxMessagesPerSession = maxMessagesPerSession

    config.updatedBy = req.user?.id || null

    await config.save()

    logger.info(`[Admin] Chatbot config updated by ${req.user?.id}`)
    res.json({ success: true, message: 'Cập nhật cấu hình chatbot thành công!', data: config })
  } catch (err) {
    logger.error('[Admin] Update chatbot config error:', err.message)
    res.status(500).json({ success: false, message: 'Cập nhật cấu hình thất bại!' })
  }
}

// POST /api/v1/admin/chatbot-config/test
exports.testConnection = async (req, res) => {
  try {
    const aiService = require('../../services/ai/ai.service')
    const { provider, model } = aiService.getActiveConfig()

    // Gửi một message test đơn giản
    const result = await aiService.processMessage(
      'test_' + Date.now(),
      'Xin chào, bạn là ai?',
      { name: 'Admin Test', userId: 'admin' }
    )

    if (result && result.text) {
      res.json({
        success: true,
        message: 'Kết nối thành công!',
        data: {
          provider,
          model,
          response: result.text,
          metadata: result.metadata
        }
      })
    } else {
      res.json({
        success: false,
        message: 'AI không trả về response',
        data: { provider, model }
      })
    }
  } catch (err) {
    logger.error('[Admin] Test chatbot connection error:', err.message)
    res.status(500).json({
      success: false,
      message: `Lỗi kết nối: ${err.message}`,
      data: { error: err.message }
    })
  }
}
