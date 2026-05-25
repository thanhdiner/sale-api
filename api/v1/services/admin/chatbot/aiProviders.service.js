const mongoose = require('mongoose')
const { listAdapterModels, testAdapter } = require('../../ai/core/ai.adapters')

const aiProviderRepository = require('../../../repositories/chatbot/aiProvider.repository')
const aiProviderKeysService = require('./aiProviderKeys.service')
const AppError = require('../../../utils/AppError')
const aiConfig = require('../../ai/core/ai.config')

function getValidAdminId(userId) {
  return userId && mongoose.Types.ObjectId.isValid(userId) ? userId : null
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : value
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return []
  return [...new Set(value.map(item => normalizeString(item)).filter(Boolean))]
}

function normalizeProviderCode(value) {
  return String(value || '').trim().toLowerCase()
}

function normalizeBoolean(value, fallback = false) {
  return value === undefined || value === null ? fallback : value !== false
}

function normalizeNumber(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

function normalizeHeaders(value) {
  if (!value) return {}

  let source = value
  if (typeof value === 'string') {
    try {
      source = JSON.parse(value)
    } catch {
      throw new AppError('Headers must be a valid JSON object', 400)
    }
  }

  if (source instanceof Map) source = Object.fromEntries(source)
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    throw new AppError('Headers must be a JSON object', 400)
  }

  return Object.entries(source).reduce((headers, [key, headerValue]) => {
    const normalizedKey = String(key || '').trim()
    if (!normalizedKey) return headers
    headers[normalizedKey] = String(headerValue ?? '').trim()
    return headers
  }, {})
}

function serializeHeaders(value) {
  if (!value) return {}
  if (value instanceof Map) return Object.fromEntries(value)
  return { ...value }
}

function normalizeModelDefinition(value = {}) {
  const model = normalizeString(value.model)
  if (!model) return null

  return {
    model,
    displayName: normalizeString(value.displayName) || model,
    enabled: normalizeBoolean(value.enabled, true),
    supportsTools: normalizeBoolean(value.supportsTools, true),
    supportsVision: normalizeBoolean(value.supportsVision, false),
    supportsJsonMode: normalizeBoolean(value.supportsJsonMode, true),
    supportsStreaming: normalizeBoolean(value.supportsStreaming, true),
    contextWindow: normalizeNumber(value.contextWindow, 0),
    maxOutputTokens: normalizeNumber(value.maxOutputTokens, 0),
    costLevel: ['low', 'medium', 'high'].includes(value.costLevel) ? value.costLevel : 'medium',
    speedLevel: ['slow', 'medium', 'fast'].includes(value.speedLevel) ? value.speedLevel : 'medium'
  }
}

function normalizeProviderModels(value) {
  if (!Array.isArray(value)) return []

  const seen = new Set()
  return value.reduce((models, item) => {
    const model = normalizeModelDefinition(item)
    if (!model || seen.has(model.model)) return models
    seen.add(model.model)
    models.push(model)
    return models
  }, [])
}

function buildModelsFromAllowedList(provider = {}) {
  const allowedModels = Array.isArray(provider.allowedModels) ? provider.allowedModels : []
  const modelValues = allowedModels.length
    ? allowedModels
    : (provider.defaultModel ? [provider.defaultModel] : [])

  return normalizeProviderModels(modelValues.map(model => ({
    model,
    displayName: model,
    enabled: true
  })))
}

function getProviderModels(provider = {}) {
  const models = Array.isArray(provider.models) ? normalizeProviderModels(provider.models) : []
  return models.length ? models : buildModelsFromAllowedList(provider)
}

function getEnabledProviderModels(provider = {}) {
  return getProviderModels(provider).filter(model => model.enabled !== false)
}

function getProviderModelMetadata(provider = {}, modelValue = '') {
  const model = normalizeString(modelValue)
  if (!model) return null
  return getEnabledProviderModels(provider).find(item => item.model === model) || null
}

async function assertModelAvailableFromProvider(provider, selectedKey, model) {
  if (provider.adapter !== 'openai-compatible') return false

  let availableModels = []

  try {
    availableModels = await listAdapterModels({
      adapter: provider.adapter,
      apiKey: selectedKey.apiKey,
      baseURL: provider.baseUrl,
      headers: serializeHeaders(provider.headers),
      timeoutMs: provider.timeoutMs
    })
  } catch {
    return false
  }

  if (availableModels.length && !availableModels.includes(model)) {
    throw new AppError(`Model "${model}" is not listed by provider "${provider.code}"`, 400)
  }

  return availableModels.length > 0
}

async function serializeProvider(provider) {
  const item = provider?.toObject ? provider.toObject() : provider
  if (!item) return null

  delete item.encryptedApiKey
  const keySummary = await aiProviderKeysService.getProviderKeySummary(item.code, item.keyEnv || 'production')
  const models = getProviderModels(item)

  return {
    ...item,
    id: String(item._id),
    key: item.code,
    type: item.adapter,
    providerKind: item.providerKind || 'custom',
    description: item.description || item.notes || '',
    headers: serializeHeaders(item.headers),
    models,
    allowedModels: Array.isArray(item.allowedModels) && item.allowedModels.length
      ? item.allowedModels
      : models.map(model => model.model),
    enabledModels: getEnabledProviderModels(item).map(model => model.model),
    availableKeysCount: keySummary.count,
    maskedApiKey: keySummary.maskedKey,
    lastTested: item.lastTested ? new Date(item.lastTested).toLocaleString('en-GB') : '-'
  }
}

async function serializeProviders(providers) {
  return Promise.all(providers.map(serializeProvider))
}

function buildPayload(payload = {}, current = null, user = null) {
  const next = {}
  const fields = ['name', 'code', 'adapter', 'baseUrl', 'defaultModel', 'enabled', 'timeoutMs', 'maxRetries', 'notes', 'description', 'providerKind', 'keyStrategy', 'keyEnv']

  fields.forEach(field => {
    if (payload[field] !== undefined) next[field] = typeof payload[field] === 'string' ? payload[field].trim() : payload[field]
  })

  if (payload.key !== undefined && next.code === undefined) next.code = normalizeString(payload.key)
  if (payload.type !== undefined && next.adapter === undefined) next.adapter = normalizeString(payload.type)
  if (next.code) next.code = normalizeProviderCode(next.code)
  if (next.providerKind && !['built-in', 'custom'].includes(next.providerKind)) next.providerKind = 'custom'
  if (payload.headers !== undefined) next.headers = normalizeHeaders(payload.headers)
  if (payload.models !== undefined) next.models = normalizeProviderModels(payload.models)
  if (payload.allowedModels !== undefined) next.allowedModels = normalizeStringArray(payload.allowedModels)
  if (next.models && payload.allowedModels === undefined) next.allowedModels = next.models.map(model => model.model)
  if (next.enabled !== undefined) next.health = next.enabled ? (current?.health === 'disabled' ? 'healthy' : current?.health || 'healthy') : 'disabled'

  const models = next.models ?? getProviderModels(current || {})
  if (!current && !next.defaultModel && models.length) {
    next.defaultModel = (models.find(model => model.enabled !== false) || models[0]).model
  }

  const defaultModel = next.defaultModel ?? current?.defaultModel
  const enabledModelValues = models.filter(model => model.enabled !== false).map(model => model.model)
  const allModelValues = models.map(model => model.model)

  if (models.length && defaultModel && !allModelValues.includes(defaultModel)) {
    throw new AppError('Default model must be configured in provider models', 400)
  }

  if (models.length && defaultModel && enabledModelValues.length && !enabledModelValues.includes(defaultModel)) {
    throw new AppError('Default model must be enabled', 400)
  }

  const updatedBy = getValidAdminId(user?.userId)
  if (updatedBy) next.updatedBy = updatedBy

  return next
}

async function seedDefaultProvidersIfEmpty() {
  const existing = await aiProviderRepository.findAll({}, { lean: true })
  if (existing.length) return

  await Promise.all([
    aiProviderRepository.create({
      name: 'OpenAI',
      code: 'openai',
      providerKind: 'built-in',
      adapter: 'openai-compatible',
      baseUrl: 'https://api.openai.com/v1',
      defaultModel: 'gpt-4o-mini',
      models: [
        { model: 'gpt-4o-mini', displayName: 'GPT-4o mini', supportsTools: true, supportsVision: true, supportsJsonMode: true, supportsStreaming: true, contextWindow: 128000, maxOutputTokens: 16384, costLevel: 'low', speedLevel: 'fast' },
        { model: 'gpt-4o', displayName: 'GPT-4o', supportsTools: true, supportsVision: true, supportsJsonMode: true, supportsStreaming: true, contextWindow: 128000, maxOutputTokens: 16384, costLevel: 'medium', speedLevel: 'fast' },
        { model: 'gpt-4.1-mini', displayName: 'GPT-4.1 mini', supportsTools: true, supportsVision: true, supportsJsonMode: true, supportsStreaming: true, contextWindow: 1000000, maxOutputTokens: 32768, costLevel: 'medium', speedLevel: 'fast' }
      ],
      allowedModels: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini']
    }),
    aiProviderRepository.create({
      name: 'DeepSeek',
      code: 'deepseek',
      providerKind: 'built-in',
      adapter: 'openai-compatible',
      baseUrl: 'https://api.deepseek.com',
      defaultModel: 'deepseek-chat',
      models: [
        { model: 'deepseek-chat', displayName: 'DeepSeek Chat', supportsTools: true, supportsJsonMode: true, supportsStreaming: true, contextWindow: 64000, maxOutputTokens: 8000, costLevel: 'low', speedLevel: 'fast' },
        { model: 'deepseek-reasoner', displayName: 'DeepSeek Reasoner', supportsTools: false, supportsJsonMode: true, supportsStreaming: true, contextWindow: 64000, maxOutputTokens: 8000, costLevel: 'medium', speedLevel: 'slow' }
      ],
      allowedModels: ['deepseek-chat', 'deepseek-reasoner']
    }),
    aiProviderRepository.create({
      name: 'Groq',
      code: 'groq',
      providerKind: 'built-in',
      adapter: 'openai-compatible',
      baseUrl: 'https://api.groq.com/openai/v1',
      defaultModel: 'llama-3.3-70b-versatile',
      models: [
        { model: 'llama-3.3-70b-versatile', displayName: 'Llama 3.3 70B Versatile', supportsTools: true, supportsStreaming: true, contextWindow: 128000, maxOutputTokens: 32768, costLevel: 'low', speedLevel: 'fast' },
        { model: 'llama-3.1-8b-instant', displayName: 'Llama 3.1 8B Instant', supportsTools: true, supportsStreaming: true, contextWindow: 128000, maxOutputTokens: 8192, costLevel: 'low', speedLevel: 'fast' }
      ],
      allowedModels: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant']
    }),
    aiProviderRepository.create({
      name: '9Router',
      code: '9router',
      providerKind: 'built-in',
      adapter: 'openai-compatible',
      baseUrl: 'http://localhost:20128/v1',
      defaultModel: 'gpt-4o-mini',
      models: [{ model: 'gpt-4o-mini', displayName: 'GPT-4o mini', supportsTools: true, supportsVision: true, supportsJsonMode: true, supportsStreaming: true, contextWindow: 128000, maxOutputTokens: 16384, costLevel: 'low', speedLevel: 'fast' }],
      allowedModels: ['gpt-4o-mini']
    })
  ])
}

async function listProviders() {
  await seedDefaultProvidersIfEmpty()
  const providers = await aiProviderRepository.findAll({}, { sort: { createdAt: -1 } })
  return { success: true, data: await serializeProviders(providers) }
}

async function createProvider(payload = {}, user = null) {
  const data = buildPayload(payload, null, user)
  const existing = await aiProviderRepository.findOne({ code: data.code })

  if (existing) throw new AppError('Provider code da ton tai', 409)

  let provider = await aiProviderRepository.create(data)
  if (String(payload.apiKey || '').trim()) {
    await aiProviderKeysService.upsertProviderDefaultKey(provider.code, {
      apiKey: payload.apiKey,
      env: provider.keyEnv || 'production',
      alias: `${provider.name} default key`
    }, user)
    provider = await aiProviderRepository.findById(provider._id)
  }
  aiConfig.clearClientCache(provider.code)

  return { success: true, message: 'Tao AI provider thanh cong', data: await serializeProvider(provider) }
}

async function getProviderOrThrow(id) {
  const provider = await aiProviderRepository.findById(id)
  if (!provider) throw new AppError('Khong tim thay AI provider', 404)
  return provider
}

async function updateProvider(id, payload = {}, user = null) {
  const current = await getProviderOrThrow(id)
  let provider = await aiProviderRepository.updateById(id, buildPayload(payload, current, user))
  if (String(payload.apiKey || '').trim()) {
    await aiProviderKeysService.upsertProviderDefaultKey(provider.code, {
      apiKey: payload.apiKey,
      env: provider.keyEnv || 'production',
      alias: `${provider.name} default key`
    }, user)
    provider = await aiProviderRepository.findById(provider._id)
  }
  aiConfig.clearClientCache(current.code)
  aiConfig.clearClientCache(provider.code)

  return { success: true, message: 'Cap nhat AI provider thanh cong', data: await serializeProvider(provider) }
}

async function toggleProvider(id, user = null) {
  const current = await getProviderOrThrow(id)
  const enabled = !current.enabled
  const provider = await aiProviderRepository.updateById(id, {
    enabled,
    health: enabled ? 'healthy' : 'disabled',
    updatedBy: getValidAdminId(user?.userId)
  })
  aiConfig.clearClientCache(provider.code)

  return { success: true, message: 'Cap nhat trang thai provider thanh cong', data: await serializeProvider(provider) }
}

async function testProvider(id, options = {}) {
  const provider = await getProviderOrThrow(id)

  if (!provider.enabled) throw new AppError('Provider dang tat', 400)
  const modelOverride = normalizeString(options.model)
  const testModel = modelOverride || provider.defaultModel
  if (!testModel) throw new AppError('Provider chua co model de test', 400)

  if (!modelOverride) {
    const selectedModel = getProviderModelMetadata(provider, testModel)
    if (!selectedModel) throw new AppError('Default model is not enabled for this provider', 400)
  }

  const keyEnv = provider.keyEnv || 'production'
  const selectedKey = await aiProviderKeysService.selectKeyForProvider(provider.code, keyEnv)
  if (!selectedKey?.apiKey) {
    throw new AppError(`Provider "${provider.code}" chua co API key enabled trong env "${keyEnv}". Hay tao key dung provider/env trong AI Provider Keys.`, 400)
  }

  try {
    if (modelOverride) {
      const modelAvailabilityValidated = await assertModelAvailableFromProvider(provider, selectedKey, testModel)
      if (modelAvailabilityValidated) {
        provider.health = 'healthy'
        provider.lastError = '-'
        provider.lastTested = new Date()
        await provider.save()
        await aiProviderKeysService.createLog({ providerCode: provider.code, keyId: selectedKey.id, maskedKey: selectedKey.maskedKey, model: testModel, type: 'admin-test-provider', tokens: 0, status: 'success' })
        aiConfig.clearClientCache(provider.code)

        return {
          success: true,
          message: 'Model is available from provider',
          data: await serializeProvider(provider)
        }
      }
    }

    await testAdapter({
      adapter: provider.adapter,
      apiKey: selectedKey.apiKey,
      baseURL: provider.baseUrl,
      headers: serializeHeaders(provider.headers),
      model: testModel,
      timeoutMs: provider.timeoutMs,
      maxRetries: provider.maxRetries
    })

    provider.health = 'healthy'
    provider.lastError = '-'
    await aiProviderKeysService.createLog({ providerCode: provider.code, keyId: selectedKey.id, maskedKey: selectedKey.maskedKey, model: testModel, type: 'admin-test-provider', tokens: 8, status: 'success' })
  } catch (error) {
    provider.health = 'failed'
    provider.lastError = error.message || 'Provider test failed'
    await aiProviderKeysService.createLog({ providerCode: provider.code, keyId: selectedKey.id, maskedKey: selectedKey.maskedKey, model: testModel, type: 'admin-test-provider', tokens: 0, status: 'failed', error: provider.lastError })
  }

  provider.lastTested = new Date()
  await provider.save()
  aiConfig.clearClientCache(provider.code)

  return {
    success: provider.health === 'healthy',
    message: provider.health === 'healthy' ? 'Provider connection OK' : provider.lastError,
    data: await serializeProvider(provider)
  }
}

async function deleteProvider(id) {
  const provider = await getProviderOrThrow(id)
  const runtimeRepository = require('../../../repositories/chatbot/aiRuntimeSettings.repository')
  const runtime = await runtimeRepository.findOne({ lean: true })

  if (runtime?.activeProviderCode === provider.code) {
    throw new AppError('Khong the xoa provider dang active trong runtime', 400)
  }

  const deleted = await aiProviderRepository.deleteById(id)
  aiConfig.clearClientCache(provider.code)
  return { success: true, message: 'Da xoa AI provider', data: await serializeProvider(deleted) }
}

async function getEnabledProviderConfig(code, modelOverride = null) {
  const provider = await aiProviderRepository.findOne({ code: normalizeProviderCode(code), enabled: true }, { lean: true })
  if (!provider) return null
  const model = modelOverride || provider.defaultModel
  const modelMetadata = getProviderModelMetadata(provider, model)
  if (!modelMetadata) return null

  const selectedKey = await aiProviderKeysService.selectKeyForProvider(provider.code, provider.keyEnv || 'production')
  if (!selectedKey?.apiKey) return null

  return {
    provider: provider.code,
    model,
    adapter: provider.adapter,
    baseURL: provider.baseUrl,
    apiKey: selectedKey.apiKey,
    headers: serializeHeaders(provider.headers),
    timeoutMs: provider.timeoutMs,
    maxRetries: provider.maxRetries,
    modelMetadata,
    keyId: selectedKey.id,
    maskedKey: selectedKey.maskedKey,
    updatedAt: provider.updatedAt
  }
}

module.exports = {
  listProviders,
  createProvider,
  updateProvider,
  toggleProvider,
  testProvider,
  deleteProvider,
  getEnabledProviderConfig,
  getProviderModels,
  getEnabledProviderModels,
  getProviderModelMetadata
}
