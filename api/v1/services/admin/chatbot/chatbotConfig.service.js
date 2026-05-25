const mongoose = require('mongoose')

const chatbotConfigRepository = require('../../../repositories/chatbot/chatbotConfig.repository')
const agentToolCallRepository = require('../../../repositories/chatbot/agentToolCall.repository')
const chatbotRulesHistoryRepository = require('../../../repositories/chatbot/chatbotRulesHistory.repository')
const aiProviderRepository = require('../../../repositories/chatbot/aiProvider.repository')
const aiProvidersService = require('./aiProviders.service')
const AppError = require('../../../utils/AppError')
const logger = require('../../../../../config/logger')
const { getToolRegistry } = require('../../ai/tools/ai.tools')
const { buildSystemPrompt } = require('../../ai/prompts/prompt.builder')
const {
  DEFAULT_FALLBACK_MESSAGE,
  DEFAULT_ESCALATE_KEYWORDS,
  DEFAULT_SYSTEM_RULES
} = require('../../ai/core/ai.constants')

function getValidAdminId(userId) {
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    return null
  }

  return userId
}

function normalizeStringArray(value, maxItemLength = 500) {
  if (!Array.isArray(value)) return []

  const seen = new Set()
  const items = []

  value.forEach(item => {
    const text = typeof item === 'string' ? item.trim() : ''
    if (!text) return
    if (text.length > maxItemLength) throw new AppError(`Noi dung qua dai, gioi han ${maxItemLength} ky tu`, 400)
    const key = text.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    items.push(text)
  })

  return items
}

const RULE_FIELDS = ['brandVoice', 'systemPromptOverride', 'fallbackMessage', 'systemRules', 'autoEscalateKeywords']

const RULE_DEFAULTS = {
  brandVoice: '',
  systemPromptOverride: '',
  fallbackMessage: DEFAULT_FALLBACK_MESSAGE,
  systemRules: DEFAULT_SYSTEM_RULES,
  autoEscalateKeywords: DEFAULT_ESCALATE_KEYWORDS
}

function pickRulesSnapshot(config = {}) {
  return {
    brandVoice: config.brandVoice || '',
    systemPromptOverride: config.systemPromptOverride || '',
    fallbackMessage: config.fallbackMessage || DEFAULT_FALLBACK_MESSAGE,
    systemRules: Array.isArray(config.systemRules) ? config.systemRules : DEFAULT_SYSTEM_RULES,
    autoEscalateKeywords: Array.isArray(config.autoEscalateKeywords) ? config.autoEscalateKeywords : DEFAULT_ESCALATE_KEYWORDS
  }
}

function getChangedRuleFields(previous, next) {
  return RULE_FIELDS.filter(field => JSON.stringify(previous[field]) !== JSON.stringify(next[field]))
}

function validateRuleText(field, value, maxLength) {
  if (value !== undefined && String(value || '').length > maxLength) {
    throw new AppError(`${field} vuot qua ${maxLength} ky tu`, 400)
  }
}

function normalizeRulePayload(payload = {}) {
  const next = {}
  if (payload.brandVoice !== undefined) {
    validateRuleText('brandVoice', payload.brandVoice, 2000)
    next.brandVoice = String(payload.brandVoice || '').trim()
  }
  if (payload.systemPromptOverride !== undefined) {
    validateRuleText('systemPromptOverride', payload.systemPromptOverride, 8000)
    next.systemPromptOverride = String(payload.systemPromptOverride || '').trim()
  }
  if (payload.fallbackMessage !== undefined) {
    validateRuleText('fallbackMessage', payload.fallbackMessage, 500)
    next.fallbackMessage = String(payload.fallbackMessage || '').trim()
  }
  if (payload.systemRules !== undefined) next.systemRules = normalizeStringArray(payload.systemRules, 500)
  if (payload.autoEscalateKeywords !== undefined) next.autoEscalateKeywords = normalizeStringArray(payload.autoEscalateKeywords, 80)
  return next
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

function normalizeProviderCode(value) {
  return String(value || '').trim().toLowerCase()
}

async function validateProviderModelSelection(providerCode, model, label = 'Provider') {
  const normalizedProviderCode = normalizeProviderCode(providerCode)
  if (!normalizedProviderCode) return null

  const provider = await aiProviderRepository.findOne({ code: normalizedProviderCode, enabled: true }, { lean: true })
  if (!provider) throw new AppError(`${label} is not enabled or does not exist`, 400)

  const selectedModel = model || provider.defaultModel
  const enabledModels = aiProvidersService.getEnabledProviderModels(provider)
  const enabledModelValues = enabledModels.map(item => item.model)
  const selectedModelMetadata = enabledModels.find(item => item.model === selectedModel)

  if (selectedModel && enabledModelValues.length && !selectedModelMetadata) {
    throw new AppError(`${label} model "${selectedModel}" is not enabled for provider "${provider.code}"`, 400)
  }

  return {
    provider,
    model: selectedModel,
    modelMetadata: selectedModelMetadata || null
  }
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
  const aiService = require('../../ai/core/ai.service')

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
  config.providerKey = config.aiProvider
  config.fallbackProviderKey = config.fallbackProvider || ''
  config.modelCapabilities = runtimeConfig.modelCapabilities || null

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
    providerKey,
    aiProvider,
    model,
    fallbackProvider,
    fallbackModel,
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
  const nextProvider = providerKey !== undefined ? providerKey : aiProvider
  if (nextProvider !== undefined) config.aiProvider = normalizeProviderCode(nextProvider)
  if (model !== undefined) config.model = model
  if (fallbackProvider !== undefined) config.fallbackProvider = normalizeProviderCode(fallbackProvider)
  if (fallbackModel !== undefined) config.fallbackModel = fallbackModel
  if (maxTokens !== undefined) config.maxTokens = maxTokens
  if (temperature !== undefined) config.temperature = temperature
  const previousRules = pickRulesSnapshot(config)
  const normalizedRules = normalizeRulePayload({ brandVoice, systemPromptOverride, systemRules, fallbackMessage, autoEscalateKeywords })

  if (brandVoice !== undefined) config.brandVoice = normalizedRules.brandVoice
  if (systemPromptOverride !== undefined) config.systemPromptOverride = normalizedRules.systemPromptOverride
  if (systemRules !== undefined) config.systemRules = normalizedRules.systemRules
  if (fallbackMessage !== undefined) config.fallbackMessage = normalizedRules.fallbackMessage
  if (autoEscalateKeywords !== undefined) config.autoEscalateKeywords = normalizedRules.autoEscalateKeywords
  if (maxMessagesPerMinute !== undefined) config.maxMessagesPerMinute = maxMessagesPerMinute
  if (maxMessagesPerSession !== undefined) config.maxMessagesPerSession = maxMessagesPerSession
  if (toolSettings !== undefined) config.toolSettings = normalizeToolSettings(toolSettings)

  await validateProviderModelSelection(config.aiProvider, config.model, 'Agent provider')
  if (config.fallbackProvider) {
    await validateProviderModelSelection(config.fallbackProvider, config.fallbackModel, 'Fallback provider')
  } else if (config.fallbackModel) {
    throw new AppError('Fallback provider is required when fallback model is set', 400)
  }

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

  const nextRules = pickRulesSnapshot(data)
  const changedRuleFields = getChangedRuleFields(previousRules, nextRules)
  if (changedRuleFields.length > 0) {
    await chatbotRulesHistoryRepository.create({
      previous: previousRules,
      next: nextRules,
      changedFields: changedRuleFields,
      updatedBy
    })
  }

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

async function getRulesDefaults() {
  return { success: true, data: RULE_DEFAULTS }
}

async function previewPrompt(payload = {}) {
  const config = await getOrCreateConfigDocument()
  const base = config.toObject()
  const overrides = normalizeRulePayload(payload)
  const merged = { ...base, ...overrides }
  const availableTools = getToolRegistry(merged.toolSettings)

  const prompt = buildSystemPrompt({
    customerInfo: {
      name: 'Khách mẫu',
      userId: 'sample-user',
      currentPage: '/products/sample',
      pageContext: {
        route: '/products/sample',
        pageType: 'product-detail',
        entity: { type: 'product', title: 'Sản phẩm mẫu', price: 299000, stock: 12 }
      }
    },
    customPrompt: merged.systemPromptOverride,
    brandVoice: merged.brandVoice,
    agentName: merged.agentName,
    agentRole: merged.agentRole,
    agentTone: merged.agentTone,
    systemRules: merged.systemRules,
    availableTools
  })

  return { success: true, data: { prompt, availableTools } }
}

async function getRulesHistory() {
  const items = await chatbotRulesHistoryRepository.findAll({}, { lean: true, limit: 20 })
  return { success: true, data: items.map(item => ({ ...item, id: String(item._id) })) }
}

async function rollbackRulesHistory(id, user = null) {
  const history = await chatbotRulesHistoryRepository.findById(id, { lean: true })
  if (!history) throw new AppError('Khong tim thay phien ban rules', 404)

  return updateConfig(history.previous || {}, user)
}

async function testRules(payload = {}) {
  const aiService = require('../../ai/core/ai.service')
  const config = await getOrCreateConfigDocument()
  const base = config.toObject()
  const overrides = normalizeRulePayload(payload)
  const message = typeof payload.message === 'string' && payload.message.trim()
    ? payload.message.trim()
    : 'Xin chào, bạn có thể hỗ trợ gì cho mình?'

  const runtimeConfig = await aiService.getRuntimeConfig({
    ...base,
    ...overrides
  })

  const result = await aiService.processMessage(
    'admin_rules_test_' + Date.now(),
    message,
    { name: 'Admin Test', userId: 'admin' },
    runtimeConfig
  )

  return {
    success: !result?.metadata?.error,
    message: result?.metadata?.error ? `Loi test: ${result.metadata.error}` : 'Test chatbot thanh cong',
    data: {
      response: result.text,
      provider: result.metadata?.provider,
      model: result.metadata?.model,
      metadata: result.metadata
    }
  }
}

async function testConnection(payload = {}) {
  const aiService = require('../../ai/core/ai.service')
  const providerOverride = payload?.providerKey || payload?.aiProvider
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
  getRulesDefaults,
  previewPrompt,
  getRulesHistory,
  rollbackRulesHistory,
  testRules,
  testConnection
}











