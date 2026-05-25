const mongoose = require('mongoose')

const runtimeRepository = require('../../../repositories/chatbot/aiRuntimeSettings.repository')
const aiProviderRepository = require('../../../repositories/chatbot/aiProvider.repository')
const aiProviderKeysService = require('./aiProviderKeys.service')
const aiProvidersService = require('./aiProviders.service')
const AppError = require('../../../utils/AppError')
const aiConfig = require('../../ai/core/ai.config')
const { testAdapter } = require('../../ai/core/ai.adapters')

function getValidAdminId(userId) {
  return userId && mongoose.Types.ObjectId.isValid(userId) ? userId : null
}

function normalizeProviderCode(value) {
  return String(value || '').trim().toLowerCase()
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return []
  return [...new Set(value.map(item => normalizeProviderCode(item)).filter(Boolean))]
}

function serializeHeaders(value) {
  if (!value) return {}
  if (value instanceof Map) return Object.fromEntries(value)
  return { ...value }
}

function buildPayload(payload = {}, user = null) {
  const next = {}
  const fields = ['activeProviderCode', 'activeModel', 'timeoutMs', 'maxRetries', 'temperature', 'maxTokens', 'enabled']

  fields.forEach(field => {
    if (payload[field] !== undefined) next[field] = typeof payload[field] === 'string' ? payload[field].trim() : payload[field]
  })

  if (next.activeProviderCode) next.activeProviderCode = normalizeProviderCode(next.activeProviderCode)
  if (payload.fallbackProviderCodes !== undefined) next.fallbackProviderCodes = normalizeStringArray(payload.fallbackProviderCodes)

  const updatedBy = getValidAdminId(user?.userId)
  if (updatedBy) next.updatedBy = updatedBy

  return next
}

async function getOrCreateSettings() {
  let settings = await runtimeRepository.findOne()
  if (!settings) settings = await runtimeRepository.create({})
  return settings
}

async function getProviderStatus(settings) {
  const provider = await aiProviderRepository.findOne({ code: settings.activeProviderCode }, { lean: true })
  if (!provider) return { provider: null, keyCount: 0 }

  const keyCount = await aiProviderKeysService.countEnabledKeys(provider.code, provider.keyEnv || 'production')
  return { provider, keyCount }
}

async function serializeSettings(settings) {
  const item = settings?.toObject ? settings.toObject() : settings
  const status = await getProviderStatus(item)

  return {
    ...item,
    id: String(item._id),
    activeProvider: status.provider,
    keyCount: status.keyCount,
    status: {
      activeProvider: item.activeProviderCode,
      model: item.activeModel,
      keyCount: status.keyCount,
      adapter: status.provider?.adapter || null,
      health: status.provider?.enabled === false ? 'disabled' : status.provider?.health || 'unknown',
      lastError: status.provider?.lastError || '-'
    }
  }
}

async function validateSettingsPayload(payload = {}) {
  const providerCode = normalizeProviderCode(payload.activeProviderCode)
  if (!providerCode) return

  const provider = await aiProviderRepository.findOne({ code: providerCode, enabled: true }, { lean: true })
  if (!provider) throw new AppError('Active provider khong ton tai hoac dang tat', 400)

  const model = payload.activeModel || provider.defaultModel
  const enabledModels = aiProvidersService.getEnabledProviderModels(provider).map(item => item.model)
  if (model && enabledModels.length && !enabledModels.includes(model)) {
    throw new AppError(`Model "${model}" is not enabled for provider "${provider.code}". Enabled models: ${enabledModels.join(', ')}`, 400)
  }

  const fallbackProviderCodes = Array.isArray(payload.fallbackProviderCodes) ? payload.fallbackProviderCodes : []
  for (const fallbackCode of fallbackProviderCodes) {
    const fallbackProvider = await aiProviderRepository.findOne({ code: normalizeProviderCode(fallbackCode), enabled: true }, { lean: true })
    if (!fallbackProvider) throw new AppError(`Fallback provider "${fallbackCode}" khong ton tai hoac dang tat`, 400)
  }
}

async function getSettings() {
  const settings = await getOrCreateSettings()
  return { success: true, data: await serializeSettings(settings) }
}

async function updateSettings(payload = {}, user = null) {
  const data = buildPayload(payload, user)
  await validateSettingsPayload(data)
  const settings = await runtimeRepository.updateOne(data)
  aiConfig.clearClientCache(data.activeProviderCode)

  return { success: true, message: 'Cap nhat AI runtime settings thanh cong', data: await serializeSettings(settings) }
}

async function testRuntime(payload = {}) {
  const settings = await getOrCreateSettings()
  const runtime = { ...(settings.toObject ? settings.toObject() : settings), ...buildPayload(payload) }

  await validateSettingsPayload(runtime)

  if (!runtime.enabled) throw new AppError('AI runtime dang tat', 400)

  const provider = await aiProviderRepository.findOne({ code: runtime.activeProviderCode, enabled: true }, { lean: true })
  if (!provider) throw new AppError('Active provider khong ton tai hoac dang tat', 400)

  const keyEnv = provider.keyEnv || 'production'
  const selectedKey = await aiProviderKeysService.selectKeyForProvider(provider.code, keyEnv)
  if (!selectedKey?.apiKey) {
    throw new AppError(`Active provider "${provider.code}" chua co API key enabled trong env "${keyEnv}". Hay tao key dung provider/env trong AI Provider Keys.`, 400)
  }

  await testAdapter({
    adapter: provider.adapter,
    apiKey: selectedKey.apiKey,
    baseURL: provider.baseUrl,
    headers: serializeHeaders(provider.headers),
    model: runtime.activeModel || provider.defaultModel,
    timeoutMs: runtime.timeoutMs || provider.timeoutMs,
    maxRetries: runtime.maxRetries ?? provider.maxRetries
  })

  await aiProviderKeysService.createLog({ providerCode: provider.code, keyId: selectedKey.id, maskedKey: selectedKey.maskedKey, model: runtime.activeModel || provider.defaultModel, type: 'admin-test-runtime', tokens: 8, status: 'success' })

  return { success: true, message: 'Runtime connection OK', data: { provider: provider.code, model: runtime.activeModel || provider.defaultModel, adapter: provider.adapter } }
}

module.exports = {
  getSettings,
  updateSettings,
  testRuntime,
  getOrCreateSettings
}
