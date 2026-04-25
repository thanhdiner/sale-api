const OpenAI = require('openai')
const logger = require('../../../../config/logger')
const chatbotConfigRepository = require('../../repositories/chatbotConfig.repository')
const { getToolRegistry } = require('./ai.tools')
const {
  DEFAULT_FALLBACK_MESSAGE,
  DEFAULT_ESCALATE_KEYWORDS,
  DEFAULT_SYSTEM_RULES,
  PROVIDERS
} = require('./ai.constants')

const clientCache = {}

function getProviderConfig(provider) {
  const config = PROVIDERS[provider]
  if (!config) {
    throw new Error(`[AI] Unknown provider: ${provider}. Supported: ${Object.keys(PROVIDERS).join(', ')}`)
  }

  if (provider === '9router') {
    return {
      ...config,
      baseURL: process.env.NINEROUTER_BASE_URL || config.baseURL
    }
  }

  return config
}

function getClient(provider) {
  if (clientCache[provider]) return clientCache[provider]

  const config = getProviderConfig(provider)
  const apiKey = process.env[config.envKey] || (config.apiKeyOptional ? config.defaultApiKey : null)

  if (!apiKey) {
    throw new Error(`[AI] Missing API key: ${config.envKey}`)
  }

  clientCache[provider] = new OpenAI({
    apiKey,
    baseURL: config.baseURL
  })

  logger.info(`[AI] Initialized ${provider} client (baseURL: ${config.baseURL})`)
  return clientCache[provider]
}

function getActiveConfig(overrides = {}) {
  const provider = String(overrides.provider || process.env.CHATBOT_PROVIDER || 'openai').toLowerCase()
  const config = PROVIDERS[provider]

  if (!config) {
    logger.warn(`[AI] Invalid provider "${provider}", falling back to openai`)
    return {
      provider: 'openai',
      model: PROVIDERS.openai.defaultModel,
      baseURL: PROVIDERS.openai.baseURL
    }
  }

  const model = overrides.model || process.env.CHATBOT_MODEL
  if (provider === '9router' && !model) {
    throw new Error('9Router requires CHATBOT_MODEL')
  }

  const activeModel = model || config.defaultModel
  if (!activeModel) {
    throw new Error(`[AI] Missing model configuration for provider: ${provider}`)
  }

  return {
    provider,
    model: activeModel,
    baseURL: getProviderConfig(provider).baseURL
  }
}

function isResolvedRuntimeConfig(value = {}) {
  return !!(
    value
    && typeof value.provider === 'string'
    && typeof value.model === 'string'
    && Array.isArray(value.toolSettings)
    && Array.isArray(value.availableTools)
  )
}

async function getRuntimeConfig(overrides = {}) {
  if (isResolvedRuntimeConfig(overrides)) {
    return overrides
  }

  let dbConfig = null

  try {
    dbConfig = await chatbotConfigRepository.findOne({}, { lean: true })
  } catch (err) {
    logger.warn(`[AI] Failed to load chatbot config from DB: ${err.message}`)
  }

  const activeConfig = getActiveConfig({
    provider: overrides.provider || dbConfig?.aiProvider,
    model: overrides.model || dbConfig?.model
  })

  const maxTokensValue = overrides.maxTokens ?? dbConfig?.maxTokens
  const temperatureValue = overrides.temperature ?? dbConfig?.temperature
  const toolSettings = Array.isArray(overrides.toolSettings)
    ? overrides.toolSettings
    : (Array.isArray(dbConfig?.toolSettings) ? dbConfig.toolSettings : [])
  const availableTools = getToolRegistry(toolSettings)

  return {
    ...activeConfig,
    agentName: overrides.agentName ?? dbConfig?.agentName ?? 'Trợ lý mua hàng',
    agentRole: overrides.agentRole ?? dbConfig?.agentRole ?? 'Hỗ trợ tìm sản phẩm, tư vấn, tra cứu khuyến mãi và đơn hàng',
    agentTone: overrides.agentTone ?? dbConfig?.agentTone ?? 'Thân thiện, ngắn gọn, rõ ràng',
    isEnabled: overrides.isEnabled ?? dbConfig?.isEnabled ?? (process.env.CHATBOT_ENABLED !== 'false'),
    maxTokens: Number.isFinite(Number(maxTokensValue))
      ? Number(maxTokensValue)
      : (parseInt(process.env.CHATBOT_MAX_TOKENS, 10) || 1000),
    temperature: Number.isFinite(Number(temperatureValue))
      ? Number(temperatureValue)
      : (parseFloat(process.env.CHATBOT_TEMPERATURE) || 0.7),
    systemPromptOverride: overrides.systemPromptOverride ?? dbConfig?.systemPromptOverride ?? '',
    systemRules: Array.isArray(overrides.systemRules)
      ? overrides.systemRules
      : (Array.isArray(dbConfig?.systemRules) && dbConfig.systemRules.length > 0
        ? dbConfig.systemRules
        : DEFAULT_SYSTEM_RULES),
    brandVoice: overrides.brandVoice ?? dbConfig?.brandVoice ?? '',
    fallbackMessage: overrides.fallbackMessage ?? dbConfig?.fallbackMessage ?? DEFAULT_FALLBACK_MESSAGE,
    autoEscalateKeywords: Array.isArray(overrides.autoEscalateKeywords)
      ? overrides.autoEscalateKeywords
      : (Array.isArray(dbConfig?.autoEscalateKeywords) && dbConfig.autoEscalateKeywords.length > 0
        ? dbConfig.autoEscalateKeywords
        : DEFAULT_ESCALATE_KEYWORDS),
    toolSettings,
    availableTools
  }
}

module.exports = {
  getProviderConfig,
  getClient,
  getActiveConfig,
  getRuntimeConfig
}
