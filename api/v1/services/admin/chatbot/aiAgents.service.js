const aiAgentRepository = require('../../../repositories/chatbot/aiAgent.repository')
const aiProviderRepository = require('../../../repositories/chatbot/aiProvider.repository')
const AppError = require('../../../utils/AppError')
const mongoose = require('mongoose')
const { TOOL_REGISTRY } = require('../../ai/tools/ai.tools')

const VALID_TOOL_NAMES = new Set(TOOL_REGISTRY.map(tool => tool.name))

function getValidAdminId(userId) {
  return userId && mongoose.Types.ObjectId.isValid(userId) ? userId : null
}

function normalizeCode(value) {
  return String(value || '').trim().toLowerCase()
}

function parseJsonArrayField(value) {
  if (Array.isArray(value)) return value
  if (typeof value !== 'string') return []

  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : value.split(',')
  } catch {
    return value.split(',')
  }
}

function normalizeBoolean(value) {
  if (typeof value === 'boolean') return value
  if (typeof value !== 'string') return value
  return value === 'true'
}

function normalizeNumber(value) {
  if (value === '' || value === null || value === undefined) return value
  const number = Number(value)
  return Number.isNaN(number) ? value : number
}

function normalizeToolIds(value) {
  const rawItems = parseJsonArrayField(value)

  const seen = new Set()
  const toolIds = []
  const invalidToolIds = []

  rawItems.forEach(item => {
    const toolId = typeof item === 'string' ? item.trim() : ''
    if (!toolId || seen.has(toolId)) return
    seen.add(toolId)

    if (!VALID_TOOL_NAMES.has(toolId)) {
      invalidToolIds.push(toolId)
      return
    }

    toolIds.push(toolId)
  })

  if (invalidToolIds.length > 0) {
    throw new AppError(`Tool khong hop le: ${invalidToolIds.join(', ')}`, 400)
  }

  return toolIds
}

function serializeAgent(agent) {
  const item = agent?.toObject ? agent.toObject() : agent
  if (!item) return null
  return {
    ...item,
    id: String(item._id)
  }
}

function buildAgentPayload(payload = {}, current = null, user = null) {
  const next = {
    name: payload.name?.trim(),
    code: payload.code !== undefined ? normalizeCode(payload.code) : current?.code,
    description: payload.description,
    avatar: payload.avatar,
    color: payload.color,
    locale: payload.locale,
    providerCode: payload.providerCode !== undefined ? normalizeCode(payload.providerCode) : current?.providerCode,
    model: payload.model?.trim(),
    systemPrompt: payload.systemPrompt,
    greeting: payload.greeting,
    fallbackMessage: payload.fallbackMessage,
    temperature: normalizeNumber(payload.temperature),
    topP: normalizeNumber(payload.topP),
    maxTokens: normalizeNumber(payload.maxTokens),
    stopSequences: payload.stopSequences !== undefined ? parseJsonArrayField(payload.stopSequences) : current?.stopSequences,
    toolIds: payload.toolIds !== undefined ? normalizeToolIds(payload.toolIds) : current?.toolIds,
    enabled: normalizeBoolean(payload.enabled),
    isDefault: normalizeBoolean(payload.isDefault)
  }

  Object.keys(next).forEach(key => next[key] === undefined && delete next[key])

  const updatedBy = getValidAdminId(user?.userId)
  if (updatedBy) next.updatedBy = updatedBy

  return next
}

async function validateProviderModel(providerCode, model) {
  const provider = await aiProviderRepository.findOne({ code: normalizeCode(providerCode) }, { lean: true })
  if (!provider) throw new AppError(`Provider "${providerCode}" khong ton tai`, 400)

  const allowed = Array.isArray(provider.models) && provider.models.length
    ? provider.models.map(item => item.model)
    : Array.isArray(provider.allowedModels) ? provider.allowedModels : []

  if (allowed.length && !allowed.includes(model)) {
    throw new AppError(`Model "${model}" khong có trong provider "${providerCode}"`, 400)
  }
}

async function getNextSortOrder() {
  const agents = await aiAgentRepository.findAll({}, { sort: { sortOrder: -1 }, lean: true })
  const top = agents[0]
  return top ? (Number(top.sortOrder) || 0) + 1 : 1
}

async function listAgents() {
  const agents = await aiAgentRepository.findAll()
  return { success: true, data: agents.map(serializeAgent) }
}

async function getAgentOrThrow(id) {
  const agent = await aiAgentRepository.findById(id)
  if (!agent) throw new AppError('Khong tim thay agent', 404)
  return agent
}

async function createAgent(payload = {}, user = null) {
  const data = buildAgentPayload(payload, null, user)
  if (!data.name) throw new AppError('Name la bat buoc', 400)
  if (!data.code) throw new AppError('Code la bat buoc', 400)
  if (!data.providerCode || !data.model) throw new AppError('Provider va model la bat buoc', 400)

  const existing = await aiAgentRepository.findOne({ code: data.code }, { lean: true })
  if (existing) throw new AppError(`Code "${data.code}" da ton tai`, 400)

  await validateProviderModel(data.providerCode, data.model)
  data.sortOrder = await getNextSortOrder()

  if (data.isDefault) {
    await aiAgentRepository.updateMany({}, { isDefault: false })
  }

  const agent = await aiAgentRepository.create(data)
  return { success: true, message: 'Da tao agent', data: serializeAgent(agent) }
}

async function updateAgent(id, payload = {}, user = null) {
  const current = await getAgentOrThrow(id)
  const data = buildAgentPayload(payload, current, user)

  if (data.code && data.code !== current.code) {
    const existing = await aiAgentRepository.findOne({ code: data.code }, { lean: true })
    if (existing) throw new AppError(`Code "${data.code}" da ton tai`, 400)
  }

  if (data.providerCode || data.model) {
    await validateProviderModel(data.providerCode || current.providerCode, data.model || current.model)
  }

  if (data.isDefault) {
    await aiAgentRepository.updateMany({ _id: { $ne: current._id } }, { isDefault: false })
  }

  const agent = await aiAgentRepository.updateById(id, data)
  return { success: true, message: 'Da cap nhat agent', data: serializeAgent(agent) }
}

async function toggleAgent(id, user = null) {
  const current = await getAgentOrThrow(id)
  const enabled = !current.enabled
  const agent = await aiAgentRepository.updateById(id, {
    enabled,
    updatedBy: getValidAdminId(user?.userId)
  })
  return { success: true, message: 'Da cap nhat trang thai agent', data: serializeAgent(agent) }
}

async function deleteAgent(id) {
  const current = await getAgentOrThrow(id)
  if (current.isDefault) throw new AppError('Khong the xoa agent mac dinh', 400)

  await aiAgentRepository.deleteById(id)
  return { success: true, message: 'Da xoa agent' }
}

async function setDefaultAgent(id) {
  const current = await getAgentOrThrow(id)
  await aiAgentRepository.updateMany({}, { isDefault: false })
  const agent = await aiAgentRepository.updateById(current._id, { isDefault: true, enabled: true })
  return { success: true, message: 'Da dat agent mac dinh', data: serializeAgent(agent) }
}

async function reorderAgent(id, direction) {
  const current = await getAgentOrThrow(id)
  const dir = direction === 'down' ? 'down' : 'up'

  const siblings = await aiAgentRepository.findAll({}, { sort: { sortOrder: 1, createdAt: 1 } })
  const index = siblings.findIndex(item => String(item._id) === String(current._id))
  const swapIndex = dir === 'up' ? index - 1 : index + 1

  if (index < 0 || swapIndex < 0 || swapIndex >= siblings.length) {
    return { success: true, message: 'Khong the di chuyen them', data: siblings.map(serializeAgent) }
  }

  const target = siblings[swapIndex]
  const currentOrder = Number(current.sortOrder) || 0
  const targetOrder = Number(target.sortOrder) || 0
  const nextCurrent = targetOrder === currentOrder ? targetOrder + (dir === 'up' ? -1 : 1) : targetOrder
  const nextTarget = targetOrder === currentOrder ? currentOrder : currentOrder

  await Promise.all([
    aiAgentRepository.updateById(current._id, { sortOrder: nextCurrent }),
    aiAgentRepository.updateById(target._id, { sortOrder: nextTarget })
  ])

  const updated = await aiAgentRepository.findAll()
  return { success: true, message: 'Da cap nhat thu tu', data: updated.map(serializeAgent) }
}

module.exports = {
  listAgents,
  createAgent,
  updateAgent,
  toggleAgent,
  deleteAgent,
  setDefaultAgent,
  reorderAgent
}
