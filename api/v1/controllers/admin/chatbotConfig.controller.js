const mongoose = require('mongoose')

const ChatbotConfig = require('../../models/chatbot.model')
const AgentToolCall = require('../../models/agentToolCall.model')
const logger = require('../../../../config/logger')
const { getToolRegistry } = require('../../services/ai/ai.tools')

function getValidAdminId(userId) {
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    return null
  }

  return userId
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return []

  return [...new Set(
    value
      .map(item => (typeof item === 'string' ? item.trim() : ''))
      .filter(Boolean)
  )]
}

function normalizeToolSettings(toolSettings) {
  if (!Array.isArray(toolSettings)) return []

  return toolSettings
    .filter(item => item && typeof item.name === 'string')
    .map(item => ({
      name: item.name.trim(),
      enabled: item.enabled !== false
    }))
    .filter(item => item.name)
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
    const runtimeConfig = await aiService.getRuntimeConfig().catch(runtimeErr => ({
      runtimeConfigError: runtimeErr.message
    }))

    config.rawEnvEnabled = process.env.CHATBOT_ENABLED !== 'false'
    config.rawEnvProvider = (process.env.CHATBOT_PROVIDER || 'openai').toLowerCase()
    config.rawEnvModel = process.env.CHATBOT_MODEL || null
    config.rawEnvBaseUrl = process.env.NINEROUTER_BASE_URL || null

    config.runtimeEnabled = runtimeConfig.isEnabled ?? config.rawEnvEnabled
    config.runtimeProvider = runtimeConfig.provider || config.aiProvider || config.rawEnvProvider
    config.runtimeModel = runtimeConfig.model || config.model || config.rawEnvModel
    config.runtimeBaseUrl = runtimeConfig.baseURL || config.rawEnvBaseUrl
    config.runtimeConfigError = runtimeConfig.runtimeConfigError || null
    config.envEnabled = config.runtimeEnabled
    config.envProvider = config.runtimeProvider
    config.envModel = config.runtimeModel
    config.envBaseUrl = config.runtimeBaseUrl
    config.toolRegistry = runtimeConfig.availableTools || getToolRegistry(config.toolSettings)

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
      agentName,
      agentRole,
      agentTone,
      isEnabled,
      aiProvider,
      model,
      maxTokens,
      temperature,
      brandVoice,
      systemPromptOverride,
      systemRules,
      fallbackMessage,
      autoEscalateKeywords,
      maxMessagesPerMinute,
      maxMessagesPerSession,
      toolSettings
    } = req.body

    let config = await ChatbotConfig.findOne()
    if (!config) {
      config = new ChatbotConfig()
    }

    if (agentName !== undefined) config.agentName = agentName
    if (agentRole !== undefined) config.agentRole = agentRole
    if (agentTone !== undefined) config.agentTone = agentTone
    if (isEnabled !== undefined) config.isEnabled = isEnabled
    if (aiProvider !== undefined) config.aiProvider = aiProvider
    if (model !== undefined) config.model = model
    if (maxTokens !== undefined) config.maxTokens = maxTokens
    if (temperature !== undefined) config.temperature = temperature
    if (brandVoice !== undefined) config.brandVoice = brandVoice
    if (systemPromptOverride !== undefined) config.systemPromptOverride = systemPromptOverride
    if (systemRules !== undefined) config.systemRules = normalizeStringArray(systemRules)
    if (fallbackMessage !== undefined) config.fallbackMessage = fallbackMessage
    if (autoEscalateKeywords !== undefined) {
      config.autoEscalateKeywords = normalizeStringArray(autoEscalateKeywords)
    }
    if (maxMessagesPerMinute !== undefined) config.maxMessagesPerMinute = maxMessagesPerMinute
    if (maxMessagesPerSession !== undefined) config.maxMessagesPerSession = maxMessagesPerSession
    if (toolSettings !== undefined) config.toolSettings = normalizeToolSettings(toolSettings)

    const updatedBy = getValidAdminId(req.user?.userId)
    if (req.user?.userId && !updatedBy) {
      logger.warn(`[Admin] Invalid admin userId in chatbot config update: ${req.user.userId}`)
    }

    config.updatedBy = updatedBy

    await config.save()

    const data = config.toObject()
    data.toolRegistry = getToolRegistry(config.toolSettings)

    logger.info(`[Admin] Chatbot config updated by ${updatedBy || 'unknown'}`)
    res.json({ success: true, message: 'Cap nhat cau hinh chatbot thanh cong!', data })
  } catch (err) {
    logger.error(`[Admin] Update chatbot config error: ${err.stack || err.message || err}`)
    res.status(500).json({ success: false, message: err.message || 'Cap nhat cau hinh chatbot that bai!' })
  }
}

// GET /api/v1/admin/chatbot-config/tool-logs
exports.getToolLogs = async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100)
    const toolName = typeof req.query.toolName === 'string' ? req.query.toolName.trim() : ''
    const sessionId = typeof req.query.sessionId === 'string' ? req.query.sessionId.trim() : ''

    const filter = {}
    if (toolName) filter.toolName = toolName
    if (sessionId) filter.sessionId = sessionId

    const [logs, total, errorCount] = await Promise.all([
      AgentToolCall.find(filter).sort({ createdAt: -1 }).limit(limit).lean(),
      AgentToolCall.countDocuments(filter),
      AgentToolCall.countDocuments({ ...filter, outcome: 'error' })
    ])

    res.json({
      success: true,
      data: logs,
      meta: {
        total,
        errorCount
      }
    })
  } catch (err) {
    logger.error(`[Admin] Get tool logs error: ${err.stack || err.message || err}`)
    res.status(500).json({ success: false, message: 'Khong the tai tool logs' })
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
