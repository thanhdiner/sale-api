const logger = require('../../../../../config/logger')
const { createAIClient } = require('./ai.adapters')
const chatbotConfigRepository = require('../../../repositories/chatbot/chatbotConfig.repository')
const { TOOL_REGISTRY, getToolRegistry } = require('../tools/ai.tools')
const {
  DEFAULT_FALLBACK_MESSAGE,
  DEFAULT_ESCALATE_KEYWORDS,
  DEFAULT_SYSTEM_RULES,
  PROVIDERS
} = require('./ai.constants')

const clientCache = {}
const resolvedProviderConfigs = {}

function clearClientCache(provider) {
  if (!provider) {
    Object.keys(clientCache).forEach(key => delete clientCache[key])
    Object.keys(resolvedProviderConfigs).forEach(key => delete resolvedProviderConfigs[key])
    return
  }

  delete clientCache[provider]
  delete resolvedProviderConfigs[provider]
}

function getProviderConfig(provider) {
  if (resolvedProviderConfigs[provider]) return resolvedProviderConfigs[provider]

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
  const apiKey = config.apiKey || process.env[config.envKey] || (config.apiKeyOptional ? config.defaultApiKey : null)

  if (!apiKey) {
    throw new Error(`[AI] Missing API key: ${config.envKey}`)
  }

  clientCache[provider] = createAIClient({
    adapter: config.adapter || 'openai-compatible',
    apiKey,
    baseURL: config.baseURL,
    headers: config.headers,
    timeoutMs: config.timeoutMs,
    maxRetries: config.maxRetries,
    model: config.defaultModel
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

function normalizeProviderCode(value) {
  return String(value || '').trim().toLowerCase()
}

function normalizeAgentCode(value) {
  return String(value || '').trim().toLowerCase()
}

function normalizeToolSettings(toolSettings = []) {
  return new Map(
    (Array.isArray(toolSettings) ? toolSettings : [])
      .filter(item => item && typeof item.name === 'string')
      .map(item => [item.name.trim(), item.enabled !== false])
      .filter(([name]) => name)
  )
}

function buildAgentToolSettings(globalToolSettings = [], agentToolIds = []) {
  if (!Array.isArray(agentToolIds) || agentToolIds.length === 0) {
    return Array.isArray(globalToolSettings) ? globalToolSettings : []
  }

  const globalSettingsMap = normalizeToolSettings(globalToolSettings)
  const agentToolSet = new Set(agentToolIds.filter(Boolean))

  return TOOL_REGISTRY.map(tool => ({
    name: tool.name,
    enabled: agentToolSet.has(tool.name)
      && (globalSettingsMap.has(tool.name) ? globalSettingsMap.get(tool.name) : tool.defaultEnabled)
  }))
}

function serializeRuntimeAgent(agent) {
  if (!agent) return null

  return {
    id: String(agent._id || agent.id),
    name: agent.name,
    code: agent.code,
    description: agent.description || '',
    providerCode: agent.providerCode,
    model: agent.model,
    systemPrompt: agent.systemPrompt || '',
    fallbackMessage: agent.fallbackMessage || '',
    temperature: agent.temperature,
    topP: agent.topP,
    maxTokens: agent.maxTokens,
    toolIds: Array.isArray(agent.toolIds) ? agent.toolIds : []
  }
}

async function resolveRuntimeAgent(overrides = {}) {
  const agentCode = normalizeAgentCode(overrides.agentCode || overrides.aiAgentCode)
  const shouldUseDefaultAgent = overrides.useDefaultAgent === true || !!agentCode

  if (!shouldUseDefaultAgent) return null

  try {
    const aiAgentRepository = require('../../../repositories/chatbot/aiAgent.repository')
    const query = agentCode
      ? { code: agentCode, enabled: true }
      : { isDefault: true, enabled: true }
    const agent = await aiAgentRepository.findOne(query, { lean: true })
    return serializeRuntimeAgent(agent)
  } catch (err) {
    logger.warn(`[AI] Failed to load AI agent: ${err.message}`)
    return null
  }
}

function getFallbackProviderModels(dbConfig = {}, runtimeSettings = {}, overrides = {}) {
  if (Array.isArray(overrides.fallbackProviderModels)) return overrides.fallbackProviderModels

  const fallbackProviderModels = []
  if (dbConfig?.fallbackProvider) {
    fallbackProviderModels.push({
      provider: normalizeProviderCode(dbConfig.fallbackProvider),
      model: dbConfig.fallbackModel || null
    })
  }

  ;(runtimeSettings?.fallbackProviderCodes || []).forEach(provider => {
    const providerCode = normalizeProviderCode(provider)
    if (!providerCode || fallbackProviderModels.some(item => item.provider === providerCode)) return
    fallbackProviderModels.push({ provider: providerCode, model: null })
  })

  return fallbackProviderModels.filter(item => item.provider)
}

async function getRuntimeConfig(overrides = {}) {
  if (isResolvedRuntimeConfig(overrides)) {
    return overrides
  }

  let dbConfig = null
  let runtimeSettings = null

  try {
    dbConfig = await chatbotConfigRepository.findOne({}, { lean: true })
  } catch (err) {
    logger.warn(`[AI] Failed to load chatbot config from DB: ${err.message}`)
  }

  try {
    const runtimeRepository = require('../../../repositories/chatbot/aiRuntimeSettings.repository')
    runtimeSettings = await runtimeRepository.findOne({ lean: true })
  } catch (err) {
    logger.warn(`[AI] Failed to load AI runtime settings from DB: ${err.message}`)
  }

  const runtimeAgent = await resolveRuntimeAgent(overrides)
  let providerCode = normalizeProviderCode(overrides.provider || overrides.providerKey || runtimeAgent?.providerCode || dbConfig?.aiProvider || runtimeSettings?.activeProviderCode || process.env.CHATBOT_PROVIDER || 'openai')
  const requestedModel = overrides.model || runtimeAgent?.model || dbConfig?.model || runtimeSettings?.activeModel || process.env.CHATBOT_MODEL
  const fallbackProviderModels = getFallbackProviderModels(dbConfig, runtimeSettings, overrides)
  let dbProviderConfig = null

  try {
    const aiProvidersService = require('../../admin/chatbot/aiProviders.service')
    dbProviderConfig = await aiProvidersService.getEnabledProviderConfig(providerCode, requestedModel)
  } catch (err) {
    logger.warn(`[AI] Failed to load AI provider from DB: ${err.message}`)
  }

  if (!dbProviderConfig && !overrides.provider && !overrides.providerKey) {
    const aiProvidersService = require('../../admin/chatbot/aiProviders.service')
    for (const fallback of fallbackProviderModels) {
      dbProviderConfig = await aiProvidersService.getEnabledProviderConfig(fallback.provider, fallback.model)
      if (dbProviderConfig) {
        providerCode = normalizeProviderCode(fallback.provider)
        break
      }
    }
  }

  if (dbProviderConfig) {
    resolvedProviderConfigs[providerCode] = {
      adapter: dbProviderConfig.adapter,
      baseURL: dbProviderConfig.baseURL,
      headers: dbProviderConfig.headers,
      envKey: `DB_AI_PROVIDER_${providerCode}`,
      apiKey: dbProviderConfig.apiKey,
      defaultModel: dbProviderConfig.model,
      timeoutMs: runtimeSettings?.timeoutMs ?? dbProviderConfig.timeoutMs,
      maxRetries: runtimeSettings?.maxRetries ?? dbProviderConfig.maxRetries,
      modelMetadata: dbProviderConfig.modelMetadata
    }
  } else if (runtimeSettings?.activeProviderCode) {
    const aiProviderRepository = require('../../../repositories/chatbot/aiProvider.repository')
    const selectedProvider = await aiProviderRepository.findOne({ code: providerCode }, { lean: true })
    if (selectedProvider) {
      throw new Error(`[AI] Active provider "${providerCode}" has no enabled API key`)
    }
  }

  const activeConfig = dbProviderConfig || getActiveConfig({
    provider: providerCode,
    model: requestedModel
  })

  const maxTokensValue = overrides.maxTokens ?? runtimeAgent?.maxTokens ?? runtimeSettings?.maxTokens ?? dbConfig?.maxTokens
  const temperatureValue = overrides.temperature ?? runtimeAgent?.temperature ?? runtimeSettings?.temperature ?? dbConfig?.temperature
  const topPValue = overrides.topP ?? runtimeAgent?.topP
  const globalToolSettings = Array.isArray(overrides.toolSettings)
    ? overrides.toolSettings
    : (Array.isArray(dbConfig?.toolSettings) ? dbConfig.toolSettings : [])
  const toolSettings = buildAgentToolSettings(globalToolSettings, runtimeAgent?.toolIds)
  const availableTools = getToolRegistry(toolSettings)

  return {
    ...activeConfig,
    agentName: overrides.agentName ?? runtimeAgent?.name ?? dbConfig?.agentName ?? 'Trợ lý mua hàng',
    agentRole: overrides.agentRole ?? (runtimeAgent?.description || dbConfig?.agentRole || 'Hỗ trợ tìm sản phẩm, tư vấn, tra cứu khuyến mãi và đơn hàng'),
    agentTone: overrides.agentTone ?? dbConfig?.agentTone ?? 'Thân thiện, ngắn gọn, rõ ràng',
    isEnabled: overrides.isEnabled ?? runtimeSettings?.enabled ?? dbConfig?.isEnabled ?? (process.env.CHATBOT_ENABLED !== 'false'),
    maxTokens: Number.isFinite(Number(maxTokensValue))
      ? Number(maxTokensValue)
      : (parseInt(process.env.CHATBOT_MAX_TOKENS, 10) || 1000),
    temperature: Number.isFinite(Number(temperatureValue))
      ? Number(temperatureValue)
      : (parseFloat(process.env.CHATBOT_TEMPERATURE) || 0.7),
    topP: Number.isFinite(Number(topPValue)) ? Number(topPValue) : undefined,
    systemPromptOverride: overrides.systemPromptOverride ?? (runtimeAgent?.systemPrompt || dbConfig?.systemPromptOverride || ''),
    systemRules: Array.isArray(overrides.systemRules)
      ? overrides.systemRules
      : (Array.isArray(dbConfig?.systemRules) && dbConfig.systemRules.length > 0
        ? dbConfig.systemRules
        : DEFAULT_SYSTEM_RULES),
    brandVoice: overrides.brandVoice ?? dbConfig?.brandVoice ?? '',
    fallbackMessage: overrides.fallbackMessage ?? (runtimeAgent?.fallbackMessage || dbConfig?.fallbackMessage || DEFAULT_FALLBACK_MESSAGE),
    autoEscalateKeywords: Array.isArray(overrides.autoEscalateKeywords)
      ? overrides.autoEscalateKeywords
      : (Array.isArray(dbConfig?.autoEscalateKeywords) && dbConfig.autoEscalateKeywords.length > 0
        ? dbConfig.autoEscalateKeywords
        : DEFAULT_ESCALATE_KEYWORDS),
    toolSettings,
    availableTools,
    fallbackProviderCodes: Array.isArray(overrides.fallbackProviderCodes)
      ? overrides.fallbackProviderCodes
      : fallbackProviderModels.map(item => item.provider),
    fallbackProviderModels,
    modelCapabilities: activeConfig.modelMetadata || null,
    activeAgent: runtimeAgent,
    onActivity: overrides.onActivity
  }
}

module.exports = {
  getProviderConfig,
  getClient,
  getActiveConfig,
  getRuntimeConfig,
  clearClientCache
}



