const mongoose = require('mongoose')
const OpenAI = require('openai')

const aiProviderRepository = require('../../../repositories/chatbot/aiProvider.repository')
const keyRepository = require('../../../repositories/chatbot/aiProviderKey.repository')
const logRepository = require('../../../repositories/chatbot/aiProviderKeyLog.repository')
const settingRepository = require('../../../repositories/chatbot/aiProviderKeySetting.repository')
const AppError = require('../../../utils/AppError')
const { encryptSecret, decryptSecret } = require('../../../utils/secretCrypto')
const aiConfig = require('../../ai/core/ai.config')

function getValidAdminId(userId) {
  return userId && mongoose.Types.ObjectId.isValid(userId) ? userId : null
}

function normalizeProviderCode(value) {
  return String(value || '').trim().toLowerCase()
}

function maskApiKey(value = '') {
  const text = String(value || '').trim()
  if (!text) return ''
  if (text.length <= 8) return `${text.slice(0, 2)}...${text.slice(-2)}`
  return `${text.slice(0, 4)}...${text.slice(-4)}`
}

function serializeKey(key) {
  const item = key?.toObject ? key.toObject() : key
  if (!item) return null

  delete item.encryptedApiKey

  return {
    ...item,
    id: String(item._id),
    provider: item.providerCode,
    lastUsed: item.lastUsed ? new Date(item.lastUsed).toLocaleString('en-GB') : '-'
  }
}

function serializeLog(log) {
  const item = log?.toObject ? log.toObject() : log
  return {
    ...item,
    id: String(item._id),
    provider: item.providerCode,
    key: item.maskedKey,
    time: item.createdAt ? new Date(item.createdAt).toLocaleTimeString('en-GB') : '-'
  }
}

async function validateProviderCodeExists(providerCode) {
  const provider = await aiProviderRepository.findOne({ code: providerCode }, { lean: true })
  if (!provider) throw new AppError(`Provider code "${providerCode}" khong ton tai trong AI Providers`, 400)
}

function buildKeyPayload(payload = {}, current = null, user = null) {
  const providerCode = normalizeProviderCode(payload.providerCode || payload.provider || current?.providerCode)
  const next = {
    providerCode,
    alias: payload.alias?.trim(),
    env: payload.env || current?.env || 'production',
    enabled: payload.enabled,
    weight: payload.weight,
    requestLimit: payload.requestLimit,
    tokenLimit: payload.tokenLimit,
    notes: payload.notes
  }

  Object.keys(next).forEach(key => next[key] === undefined && delete next[key])

  if (payload.apiKey !== undefined && String(payload.apiKey).trim()) {
    next.encryptedApiKey = encryptSecret(payload.apiKey)
    next.maskedKey = maskApiKey(payload.apiKey)
  }

  if (!current && !next.encryptedApiKey) throw new AppError('API key la bat buoc', 400)

  if (next.enabled !== undefined) {
    next.health = next.enabled ? (current?.health === 'disabled' ? 'enabled' : current?.health || 'enabled') : 'disabled'
  }

  const updatedBy = getValidAdminId(user?.userId)
  if (updatedBy) next.updatedBy = updatedBy

  return next
}

async function getSettings() {
  let settings = await settingRepository.findOne()
  if (!settings) settings = await settingRepository.create({})
  return { success: true, data: settings }
}

async function updateSettings(payload = {}, user = null) {
  const update = { updatedBy: getValidAdminId(user?.userId) }

  if (payload.strategy !== undefined) {
    if (!['round-robin', 'least-used', 'weighted'].includes(payload.strategy)) {
      throw new AppError('Strategy khong hop le', 400)
    }
    update.strategy = payload.strategy
  }

  if (payload.roundRobinEnabled !== undefined) {
    update.roundRobinEnabled = Boolean(payload.roundRobinEnabled)
    update.strategy = update.roundRobinEnabled ? 'round-robin' : (payload.strategy || 'weighted')
  }

  if (payload.stickyCount !== undefined) {
    const count = Number(payload.stickyCount)
    if (!Number.isFinite(count) || count < 1 || count > 1000) {
      throw new AppError('Sticky count phai trong khoang 1-1000', 400)
    }
    update.stickyCount = Math.floor(count)
    update.stickyHits = 0
  }

  const settings = await settingRepository.updateOne(update)

  return { success: true, message: 'Da cap nhat load balancing settings', data: settings }
}

async function listKeys(query = {}) {
  const filter = {}
  if (query.env) filter.env = query.env
  if (query.providerCode || query.provider) filter.providerCode = normalizeProviderCode(query.providerCode || query.provider)

  const keys = await keyRepository.findAll(filter, { sort: { sortOrder: 1, createdAt: 1 } })
  return { success: true, data: keys.map(serializeKey) }
}

async function getNextSortOrder(providerCode, env) {
  const keys = await keyRepository.findAll(
    { providerCode, env },
    { sort: { sortOrder: -1 }, lean: true }
  )
  const top = keys[0]
  return top ? (Number(top.sortOrder) || 0) + 1 : 1
}

async function createKey(payload = {}, user = null) {
  const data = buildKeyPayload(payload, null, user)
  await validateProviderCodeExists(data.providerCode)
  data.sortOrder = await getNextSortOrder(data.providerCode, data.env || 'production')
  const key = await keyRepository.create(data)
  return { success: true, message: 'Da them API key', data: serializeKey(key) }
}

async function reorderKey(id, direction) {
  const current = await getKeyOrThrow(id)
  const dir = direction === 'down' ? 'down' : 'up'

  const siblings = await keyRepository.findAll(
    { providerCode: current.providerCode, env: current.env },
    { sort: { sortOrder: 1, createdAt: 1 } }
  )

  const index = siblings.findIndex(item => String(item._id) === String(current._id))
  const swapIndex = dir === 'up' ? index - 1 : index + 1
  if (index < 0 || swapIndex < 0 || swapIndex >= siblings.length) {
    return { success: true, message: 'Khong the di chuyen them', data: siblings.map(serializeKey) }
  }

  const target = siblings[swapIndex]
  const currentOrder = Number(current.sortOrder) || 0
  const targetOrder = Number(target.sortOrder) || 0
  const nextCurrent = targetOrder === currentOrder ? targetOrder + (dir === 'up' ? -1 : 1) : targetOrder
  const nextTarget = targetOrder === currentOrder ? currentOrder : currentOrder

  await Promise.all([
    keyRepository.updateById(current._id, { sortOrder: nextCurrent }),
    keyRepository.updateById(target._id, { sortOrder: nextTarget })
  ])

  const updated = await keyRepository.findAll(
    { providerCode: current.providerCode, env: current.env },
    { sort: { sortOrder: 1, createdAt: 1 } }
  )

  return { success: true, message: 'Da cap nhat thu tu', data: updated.map(serializeKey) }
}

async function getKeyOrThrow(id) {
  const key = await keyRepository.findById(id)
  if (!key) throw new AppError('Khong tim thay API key', 404)
  return key
}

async function updateKey(id, payload = {}, user = null) {
  const current = await getKeyOrThrow(id)
  const data = buildKeyPayload(payload, current, user)
  await validateProviderCodeExists(data.providerCode)
  const key = await keyRepository.updateById(id, data)
  return { success: true, message: 'Da cap nhat API key', data: serializeKey(key) }
}

async function toggleKey(id, user = null) {
  const current = await getKeyOrThrow(id)
  const enabled = !current.enabled
  const key = await keyRepository.updateById(id, {
    enabled,
    health: enabled ? 'enabled' : 'disabled',
    updatedBy: getValidAdminId(user?.userId)
  })

  return { success: true, message: 'Da cap nhat trang thai key', data: serializeKey(key) }
}

async function deleteKey(id) {
  const key = await keyRepository.deleteById(id)
  if (!key) throw new AppError('Khong tim thay API key', 404)

  return { success: true, message: 'Da xoa API key', data: serializeKey(key) }
}

async function createLog(payload = {}) {
  return logRepository.create(payload)
}

async function listLogs(query = {}) {
  const filter = {}
  if (query.providerCode || query.provider) filter.providerCode = normalizeProviderCode(query.providerCode || query.provider)

  const logs = await logRepository.findAll(filter, { limit: 100 })
  return { success: true, data: logs.map(serializeLog) }
}

function getSelectableKeys(keys = []) {
  return keys.filter(key => key.enabled && key.health !== 'disabled' && key.health !== 'quota exceeded')
}

function pickWeightedKey(keys = []) {
  const enabled = getSelectableKeys(keys)
  if (!enabled.length) return null

  const totalWeight = enabled.reduce((sum, key) => sum + Math.max(Number(key.weight) || 0, 1), 0)
  let cursor = Math.random() * totalWeight

  for (const key of enabled) {
    cursor -= Math.max(Number(key.weight) || 0, 1)
    if (cursor <= 0) return key
  }

  return enabled[0]
}

async function pickRoundRobinKey(keys = []) {
  const enabled = getSelectableKeys(keys)
  if (!enabled.length) return null

  const current = await settingRepository.findOne({ lean: true })
  const stickyCount = Math.max(1, Number(current?.stickyCount) || 1)
  const cursor = Math.abs(Number(current?.roundRobinCursor) || 0) % enabled.length
  const hits = Math.max(0, Number(current?.stickyHits) || 0)

  const nextHits = hits + 1
  if (nextHits >= stickyCount) {
    await settingRepository.updateOne({ roundRobinCursor: cursor + 1, stickyHits: 0 })
  } else {
    await settingRepository.updateOne({ stickyHits: nextHits })
  }

  return enabled[cursor]
}

function pickLeastUsedKey(keys = []) {
  const enabled = getSelectableKeys(keys)
  if (!enabled.length) return null

  return [...enabled].sort((a, b) => (a.requestsToday || 0) - (b.requestsToday || 0))[0]
}

async function pickKeyByStrategy(keys = []) {
  const settings = await settingRepository.findOne({ lean: true })
  if (settings?.roundRobinEnabled) return pickRoundRobinKey(keys)

  const strategy = settings?.strategy || 'weighted'
  if (strategy === 'round-robin') return pickRoundRobinKey(keys)
  if (strategy === 'least-used') return pickLeastUsedKey(keys)
  return pickWeightedKey(keys)
}

async function selectKeyForProvider(providerCode, env = 'production') {
  const keys = await keyRepository.findAll({ providerCode: normalizeProviderCode(providerCode), env, enabled: true }, { lean: true })
  const key = await pickKeyByStrategy(keys)
  if (!key) return null

  return {
    id: key._id,
    providerCode: key.providerCode,
    apiKey: decryptSecret(key.encryptedApiKey),
    maskedKey: key.maskedKey,
    weight: key.weight
  }
}

async function countEnabledKeys(providerCode, env = 'production') {
  return keyRepository.countByQuery({ providerCode: normalizeProviderCode(providerCode), env, enabled: true })
}

async function getProviderKeySummary(providerCode, env = 'production') {
  const normalizedProviderCode = normalizeProviderCode(providerCode)
  const keys = await keyRepository.findAll(
    { providerCode: normalizedProviderCode, env, enabled: true },
    { sort: { createdAt: 1 }, lean: true }
  )

  const primaryKey = getSelectableKeys(keys)[0] || keys[0] || null
  return {
    count: keys.length,
    maskedKey: primaryKey?.maskedKey || ''
  }
}

async function upsertProviderDefaultKey(providerCode, payload = {}, user = null) {
  const normalizedProviderCode = normalizeProviderCode(providerCode)
  const env = payload.env || 'production'
  const keys = await keyRepository.findAll(
    { providerCode: normalizedProviderCode, env },
    { sort: { createdAt: 1 } }
  )

  const current = keys[0] || null
  const keyPayload = buildKeyPayload({
    providerCode: normalizedProviderCode,
    alias: payload.alias || `${normalizedProviderCode} default key`,
    env,
    apiKey: payload.apiKey,
    enabled: payload.enabled !== false,
    weight: payload.weight ?? 20,
    requestLimit: payload.requestLimit ?? 10000,
    tokenLimit: payload.tokenLimit ?? 5000000,
    notes: payload.notes || 'Managed from AI Providers'
  }, current, user)

  await validateProviderCodeExists(normalizedProviderCode)

  const key = current
    ? await keyRepository.updateById(current._id, keyPayload)
    : await keyRepository.create(keyPayload)

  return { success: true, data: serializeKey(key) }
}

async function testKey(id, options = {}) {
  const key = await getKeyOrThrow(id)
  if (!key.enabled) throw new AppError('Key dang tat', 400)

  const provider = await aiProviderRepository.findOne({ code: key.providerCode, enabled: true })
  const apiKey = decryptSecret(key.encryptedApiKey)
  const baseURL = options.baseUrl || options.baseURL || provider?.baseUrl || process.env.NINEROUTER_BASE_URL || 'http://localhost:20128/v1'
  const model = options.model || provider?.defaultModel

  if (!model) throw new AppError('Provider chua co default model de test key', 400)

  const client = new OpenAI({ apiKey, baseURL })

  try {
    await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: 'ping' }],
      max_tokens: 8
    })

    key.health = 'enabled'
    key.lastError = '-'
    key.lastUsed = new Date()
    key.requestsToday += 1
    await key.save()

    if (provider) {
      provider.health = 'healthy'
      provider.lastError = '-'
      provider.lastTested = new Date()
      await provider.save()
      aiConfig.clearClientCache(provider.code)
    }

    await createLog({ providerCode: key.providerCode, keyId: key._id, maskedKey: key.maskedKey, model, type: 'admin-test-key', tokens: 8, status: 'success' })

    return { success: true, message: 'Key test thanh cong', data: serializeKey(key) }
  } catch (error) {
    key.health = error.status === 429 ? 'rate limited' : 'error'
    key.lastError = error.message || 'Key test failed'
    key.lastUsed = new Date()
    await key.save()
    await createLog({ providerCode: key.providerCode, keyId: key._id, maskedKey: key.maskedKey, model, type: 'admin-test-key', tokens: 0, status: 'failed', error: key.lastError })

    return { success: false, message: key.lastError, data: serializeKey(key) }
  }
}

module.exports = {
  getSettings,
  updateSettings,
  listKeys,
  createKey,
  updateKey,
  toggleKey,
  deleteKey,
  testKey,
  reorderKey,
  listLogs,
  createLog,
  selectKeyForProvider,
  countEnabledKeys,
  getProviderKeySummary,
  upsertProviderDefaultKey
}
