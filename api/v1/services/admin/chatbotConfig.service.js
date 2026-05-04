const mongoose = require('mongoose')

const chatbotConfigRepository = require('../../repositories/chatbotConfig.repository')
const agentToolCallRepository = require('../../repositories/agentToolCall.repository')
const AppError = require('../../utils/AppError')
const logger = require('../../../../config/logger')
const { getToolRegistry } = require('../ai/ai.tools')

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

function normalizeValidationError(error, fallbackMessage) {
  if (error instanceof AppError) {
    return error
  }

  if (error?.name === 'ValidationError' || error?.name === 'CastError') {
    return new AppError(error.message || fallbackMessage, 400)
  }

  return error
}

async function getOrCreateConfigDocument() {
  let config = await chatbotConfigRepository.findOne()

  if (!config) {
    config = await chatbotConfigRepository.create({})
  }

  return config
}

async function getConfig() {
  const configDoc = await getOrCreateConfigDocument()
  const config = configDoc.toObject()
  const aiService = require('../ai/ai.service')

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

  return { success: true, data: config }
}

async function updateConfig(payload = {}, user = null) {
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
  } = payload

  const config = await getOrCreateConfigDocument()

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

  const updatedBy = getValidAdminId(user?.userId)
  if (user?.userId && !updatedBy) {
    logger.warn(`[Admin] Invalid admin userId in chatbot config update: ${user.userId}`)
  }

  config.updatedBy = updatedBy

  try {
    await config.save()
  } catch (error) {
    throw normalizeValidationError(error, 'Cap nhat cau hinh chatbot that bai!')
  }

  const data = config.toObject()
  data.toolRegistry = getToolRegistry(config.toolSettings)

  logger.info(`[Admin] Chatbot config updated by ${updatedBy || 'unknown'}`)

  return {
    success: true,
    message: 'Cap nhat cau hinh chatbot thanh cong!',
    data
  }
}

async function getToolLogs(query = {}) {
  const page = Math.max(parseInt(query.page, 10) || 1, 1)
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 20, 1), 100)
  const skip = (page - 1) * limit
  const toolName = typeof query.toolName === 'string' ? query.toolName.trim() : ''
  const sessionId = typeof query.sessionId === 'string' ? query.sessionId.trim() : ''

  const filter = {}
  if (toolName) filter.toolName = toolName
  if (sessionId) filter.sessionId = sessionId

  const [logs, total, errorCount] = await Promise.all([
    agentToolCallRepository.findByQuery(filter, { sort: { createdAt: -1 }, skip, limit, lean: true }),
    agentToolCallRepository.countByQuery(filter),
    agentToolCallRepository.countByQuery({ ...filter, outcome: 'error' })
  ])

  return {
    success: true,
    data: logs,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      errorCount
    }
  }
}

async function testConnection(payload = {}) {
  const aiService = require('../ai/ai.service')
  const providerOverride = payload?.aiProvider
  const modelOverride = payload?.model
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
    return {
      success: false,
      message: `Loi ket noi: ${result.metadata.error}`,
      data: {
        provider,
        model,
        response: result.text,
        metadata: result.metadata
      }
    }
  }

  if (result && result.text) {
    return {
      success: true,
      message: 'Ket noi thanh cong!',
      data: {
        provider,
        model,
        response: result.text,
        metadata: result.metadata
      }
    }
  }

  return {
    success: false,
    message: 'AI khong tra ve response',
    data: { provider, model }
  }
}

module.exports = {
  getConfig,
  updateConfig,
  getToolLogs,
  testConnection
}
