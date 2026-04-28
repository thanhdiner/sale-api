const cloudinary = require('cloudinary').v2
const streamifier = require('streamifier')

const chatMessageRepository = require('../../repositories/chatMessage.repository')
const chatConversationRepository = require('../../repositories/chatConversation.repository')
const adminAccountRepository = require('../../repositories/adminAccount.repository')
const {
  getEnglishConversationPreview,
  getSystemMessageTranslations
} = require('../../utils/chatLocalization')

const DEFAULT_CONVERSATION_LIMIT = 50
const MAX_CONVERSATION_LIMIT = 1000

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET,
  secure: true
})

const uploadBuffer = buffer =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'chat/images', resource_type: 'image' },
      (error, result) => {
        if (result) resolve(result)
        else reject(error)
      }
    )

    streamifier.createReadStream(buffer).pipe(stream)
  })

async function createSystemMessage(conversationId, sessionId, text, metadata = null) {
  const translations = getSystemMessageTranslations(metadata)
  const systemMessage = await chatMessageRepository.create({
    conversationId,
    sessionId,
    sender: 'system',
    type: 'system',
    senderName: 'System',
    message: text,
    metadata,
    ...(translations ? { translations } : {})
  })

  await chatConversationRepository.updateOne(
    { sessionId },
    {
      $set: {
        lastMessage: text,
        lastMessageAt: new Date(),
        lastMessageSender: 'system',
        lastMessageMetadata: metadata || null,
        'translations.en.lastMessage': getEnglishConversationPreview({ type: 'system', metadata }) || ''
      },
      $inc: { messageCount: 1 }
    }
  )

  return systemMessage
}

function getUploadFiles(files = {}) {
  return [
    ...(files.images || []),
    ...(files.image || [])
  ].filter(file => file?.buffer)
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function normalizeConversationListQuery(query = {}) {
  const limit = Math.min(
    parsePositiveInteger(query.limit, DEFAULT_CONVERSATION_LIMIT),
    MAX_CONVERSATION_LIMIT
  )
  const page = parsePositiveInteger(query.page, 1)
  const explicitSkip = Number.parseInt(query.skip, 10)
  const skip = Number.isFinite(explicitSkip) && explicitSkip >= 0
    ? explicitSkip
    : (page - 1) * limit

  return {
    agentId: typeof query.agentId === 'string' ? query.agentId.trim() : '',
    limit,
    page: Math.floor(skip / limit) + 1,
    search: typeof query.search === 'string' ? query.search.trim() : '',
    skip,
    status: typeof query.status === 'string' ? query.status.trim() : ''
  }
}

function buildConversationSearchFilter(search) {
  if (!search) return null

  const pattern = new RegExp(escapeRegex(search), 'i')
  return {
    $or: [
      { sessionId: pattern },
      { 'customer.name': pattern },
      { 'customer.email': pattern },
      { 'customer.currentPage': pattern },
      { 'assignedAgent.agentName': pattern },
      { lastMessage: pattern },
      { 'translations.en.lastMessage': pattern }
    ]
  }
}

async function getAgentProfile(agent = {}) {
  let account = null

  if (agent.agentId && (!agent.agentName || !agent.agentAvatar)) {
    account = await adminAccountRepository.findById(agent.agentId, {
      select: 'fullName avatarUrl',
      lean: true
    })
  }

  return {
    agentId: agent.agentId || null,
    agentName: agent.agentName || account?.fullName || 'Agent',
    agentAvatar: agent.agentAvatar || account?.avatarUrl || null
  }
}

async function hydrateConversationAgent(conversation, { persist = false } = {}) {
  const agentId = conversation?.assignedAgent?.agentId
  if (!agentId || conversation.assignedAgent.agentAvatar) return conversation

  const agent = await getAgentProfile({
    agentId,
    agentName: conversation.assignedAgent.agentName,
    agentAvatar: conversation.assignedAgent.agentAvatar
  })

  const hydratedConversation = {
    ...conversation,
    assignedAgent: {
      ...conversation.assignedAgent,
      agentName: agent.agentName,
      agentAvatar: agent.agentAvatar
    }
  }

  if (persist && agent.agentAvatar) {
    await chatConversationRepository.updateOne(
      { sessionId: conversation.sessionId },
      {
        $set: {
          'assignedAgent.agentName': agent.agentName,
          'assignedAgent.agentAvatar': agent.agentAvatar
        }
      }
    )
  }

  return hydratedConversation
}

async function getHistory({ sessionId, showInternal }) {
  const query = { sessionId }
  if (!showInternal) {
    query.isInternal = { $ne: true }
  }

  const messages = await chatMessageRepository.findByQuery(query, {
    sort: { createdAt: 1 },
    limit: 200,
    lean: true
  })

  return { success: true, data: messages }
}

async function getConversation(sessionId) {
  const conversation = await chatConversationRepository.findOne({ sessionId }, { lean: true })
  const hydratedConversation = await hydrateConversationAgent(conversation, { persist: true })
  return { success: true, data: hydratedConversation }
}

async function getConversations(query = {}) {
  const { status, agentId, limit, skip, page, search } = normalizeConversationListQuery(query)
  const filter = {}
  const searchFilter = buildConversationSearchFilter(search)

  if (status) filter.status = status
  if (agentId) filter['assignedAgent.agentId'] = agentId
  if (searchFilter) Object.assign(filter, searchFilter)

  const [rawConversations, total] = await Promise.all([
    chatConversationRepository.findByQuery(filter, {
      sort: { lastMessageAt: -1, createdAt: -1 },
      limit,
      skip,
      lean: true
    }),
    chatConversationRepository.countByQuery(filter)
  ])
  const conversations = await Promise.all(
    rawConversations.map(conversation => hydrateConversationAgent(conversation, { persist: true }))
  )

  return {
    success: true,
    data: conversations,
    pagination: {
      page,
      limit,
      skip,
      total,
      totalPages: Math.ceil(total / limit),
      hasMore: skip + conversations.length < total
    }
  }
}

async function uploadImage(files) {
  const uploadFiles = getUploadFiles(files)

  if (uploadFiles.length === 0) {
    return { statusCode: 400, body: { success: false, message: 'Vui lòng chọn ít nhất 1 file ảnh hợp lệ' } }
  }

  if (uploadFiles.length > 10) {
    return { statusCode: 400, body: { success: false, message: 'Tối đa 10 ảnh một lần gửi' } }
  }

  const results = await Promise.all(uploadFiles.map(file => uploadBuffer(file.buffer)))
  const imageUrls = results.map(result => result.secure_url).filter(Boolean)

  if (imageUrls.length === 0) {
    return { statusCode: 500, body: { success: false, message: 'Không thể upload ảnh chat' } }
  }

  return {
    statusCode: 201,
    body: {
      success: true,
      data: {
        imageUrl: imageUrls[0],
        imageUrls
      }
    }
  }
}

async function assignConversation(sessionId, payload) {
  const { agentId, agentName, agentAvatar } = await getAgentProfile(payload)

  const conversation = await chatConversationRepository.findOneAndUpdate(
    { sessionId },
    {
      $set: {
        status: 'open',
        assignedAgent: {
          agentId,
          agentName,
          agentAvatar: agentAvatar || null,
          assignedAt: new Date()
        }
      }
    },
    { new: true }
  )

  if (!conversation) {
    return { statusCode: 404, body: { success: false, message: 'Không tìm thấy' } }
  }

  const displayAgentName = agentName || 'Agent'
  const systemMessage = await createSystemMessage(
    conversation._id,
    sessionId,
    `${displayAgentName} đã tham gia cuộc trò chuyện`,
    {
      i18nKey: 'system.agentJoined',
      i18nValues: { agentName: displayAgentName }
    }
  )
  const updatedConversation = await chatConversationRepository.findOne({ sessionId }, { lean: true })
  return { statusCode: 200, body: { success: true, data: updatedConversation || conversation, systemMessage } }
}

async function resolveConversation(sessionId) {
  const conversation = await chatConversationRepository.findOneAndUpdate(
    { sessionId },
    { $set: { status: 'resolved', resolvedAt: new Date() } },
    { new: true }
  )

  if (!conversation) {
    return { statusCode: 404, body: { success: false, message: 'Không tìm thấy' } }
  }

  const systemMessage = await createSystemMessage(
    conversation._id,
    sessionId,
    'Cuộc trò chuyện đã được đánh dấu giải quyết',
    { i18nKey: 'system.resolved' }
  )
  const updatedConversation = await chatConversationRepository.findOne({ sessionId }, { lean: true })
  return { statusCode: 200, body: { success: true, data: updatedConversation || conversation, systemMessage } }
}

async function reopenConversation(sessionId) {
  const conversation = await chatConversationRepository.findOneAndUpdate(
    { sessionId },
    { $set: { status: 'open', resolvedAt: null } },
    { new: true }
  )

  if (!conversation) {
    return { statusCode: 404, body: { success: false, message: 'Không tìm thấy' } }
  }

  const systemMessage = await createSystemMessage(
    conversation._id,
    sessionId,
    'Cuộc trò chuyện được mở lại',
    { i18nKey: 'system.reopened' }
  )
  const updatedConversation = await chatConversationRepository.findOne({ sessionId }, { lean: true })
  return { statusCode: 200, body: { success: true, data: updatedConversation || conversation, systemMessage } }
}

async function markRead(sessionId, reader) {
  await chatMessageRepository.updateMany({ sessionId, isRead: false }, { $set: { isRead: true } })

  const update = reader === 'agent' ? { $set: { unreadByAgent: 0 } } : { $set: { unreadByCustomer: 0 } }
  await chatConversationRepository.updateOne({ sessionId }, update)

  return { success: true }
}

module.exports = {
  getHistory,
  getConversation,
  getConversations,
  uploadImage,
  assignConversation,
  resolveConversation,
  reopenConversation,
  markRead
}
