const mongoose = require('mongoose')

const ChatbotConfig = require('../../models/chatbot.model')
const logger = require('../../../../config/logger')

function getValidAdminId(userId) {
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    return null
  }

  return userId
}

// GET /api/v1/admin/chatbot-config
exports.getConfig = async (req, res) => {
  try {
    let config = await ChatbotConfig.findOne().lean()
    if (!config) {
      config = await ChatbotConfig.create({})
      config = config.toObject()
    }

    const aiService = require('../../services/ai/ai.service')

    config.rawEnvEnabled = process.env.CHATBOT_ENABLED !== 'false'
    config.rawEnvProvider = (process.env.CHATBOT_PROVIDER || 'openai').toLowerCase()
    config.rawEnvModel = process.env.CHATBOT_MODEL || null
    config.rawEnvBaseUrl = process.env.NINEROUTER_BASE_URL || null

    try {
      const runtimeConfig = await aiService.getRuntimeConfig()
      config.runtimeEnabled = runtimeConfig.isEnabled
      config.runtimeProvider = runtimeConfig.provider
      config.runtimeModel = runtimeConfig.model
      config.runtimeBaseUrl = runtimeConfig.baseURL
      config.runtimeConfigError = null
      config.envEnabled = runtimeConfig.isEnabled
      config.envProvider = runtimeConfig.provider
      config.envModel = runtimeConfig.model
      config.envBaseUrl = runtimeConfig.baseURL
    } catch (runtimeErr) {
      config.runtimeEnabled = process.env.CHATBOT_ENABLED !== 'false'
      config.runtimeProvider = config.aiProvider || config.rawEnvProvider
      config.runtimeModel = config.model || config.rawEnvModel
      config.runtimeBaseUrl = config.rawEnvBaseUrl
      config.runtimeConfigError = runtimeErr.message
      config.envEnabled = config.runtimeEnabled
      config.envProvider = config.runtimeProvider
      config.envModel = config.runtimeModel
      config.envBaseUrl = config.runtimeBaseUrl
    }

    config.hasOpenaiKey = !!(
      process.env.OPENAI_API_KEY
      && process.env.OPENAI_API_KEY !== 'sk-your-openai-key-here'
    )
    config.hasDeepseekKey = !!(
      process.env.DEEPSEEK_API_KEY
      && process.env.DEEPSEEK_API_KEY !== 'sk-your-deepseek-key-here'
    )
    config.hasGroqKey = !!(
      process.env.GROQ_API_KEY
      && process.env.GROQ_API_KEY !== 'gsk-your-groq-key-here'
    )
    config.has9routerKey = !!(
      process.env.NINEROUTER_API_KEY
      && process.env.NINEROUTER_API_KEY !== 'sk_9router_your_api_key_here'
    )

    res.json({ success: true, data: config })
  } catch (err) {
    logger.error(`[Admin] Get chatbot config error: ${err.stack || err.message || err}`)
    res.status(500).json({ success: false, message: 'Loi server' })
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

    const updatedBy = getValidAdminId(req.user?.userId)
    if (req.user?.userId && !updatedBy) {
      logger.warn(`[Admin] Invalid admin userId in chatbot config update: ${req.user.userId}`)
    }

    config.updatedBy = updatedBy

    await config.save()

    logger.info(`[Admin] Chatbot config updated by ${updatedBy || 'unknown'}`)
    res.json({ success: true, message: 'Cap nhat cau hinh chatbot thanh cong!', data: config })
  } catch (err) {
    logger.error(`[Admin] Update chatbot config error: ${err.stack || err.message || err}`)
    res.status(500).json({ success: false, message: err.message || 'Cap nhat cau hinh chatbot that bai!' })
  }
}

// POST /api/v1/admin/chatbot-config/test
exports.testConnection = async (req, res) => {
  try {
    const aiService = require('../../services/ai/ai.service')
    const providerOverride = req.body?.aiProvider
    const modelOverride = req.body?.model
    const runtimeConfig = await aiService.getRuntimeConfig({
      provider: providerOverride,
      model: modelOverride
    })
    const { provider, model } = runtimeConfig

    const result = await aiService.processMessage(
      'test_' + Date.now(),
      'Xin chao, ban la ai?',
      { name: 'Admin Test', userId: 'admin' },
      runtimeConfig
    )

    if (result?.metadata?.error) {
      return res.json({
        success: false,
        message: `Loi ket noi: ${result.metadata.error}`,
        data: {
          provider,
          model,
          response: result.text,
          metadata: result.metadata
        }
      })
    }

    if (result && result.text) {
      return res.json({
        success: true,
        message: 'Ket noi thanh cong!',
        data: {
          provider,
          model,
          response: result.text,
          metadata: result.metadata
        }
      })
    }

    return res.json({
      success: false,
      message: 'AI khong tra ve response',
      data: { provider, model }
    })
  } catch (err) {
    logger.error(`[Admin] Test chatbot connection error: ${err.stack || err.message || err}`)
    res.status(500).json({
      success: false,
      message: `Loi ket noi: ${err.message}`,
      data: { error: err.message }
    })
  }
}
