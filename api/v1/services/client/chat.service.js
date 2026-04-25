const cloudinary = require('cloudinary').v2
const streamifier = require('streamifier')

const chatMessageRepository = require('../../repositories/chatMessage.repository')
const chatConversationRepository = require('../../repositories/chatConversation.repository')

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

async function createSystemMessage(conversationId, sessionId, text) {
  return chatMessageRepository.create({
    conversationId,
    sessionId,
    sender: 'system',
    type: 'system',
    senderName: 'System',
    message: text
  })
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
      { lastMessage: pattern }
    ]
  }
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
  return { success: true, data: conversation }
}

async function getConversations(query = {}) {
  const { status, agentId, limit, skip, page, search } = normalizeConversationListQuery(query)
  const filter = {}
  const searchFilter = buildConversationSearchFilter(search)

  if (status) filter.status = status
  if (agentId) filter['assignedAgent.agentId'] = agentId
  if (searchFilter) Object.assign(filter, searchFilter)

  const [conversations, total] = await Promise.all([
    chatConversationRepository.findByQuery(filter, {
      sort: { lastMessageAt: -1, createdAt: -1 },
      limit,
      skip,
      lean: true
    }),
    chatConversationRepository.countByQuery(filter)
  ])

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
  const { agentId, agentName, agentAvatar } = payload

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

  const systemMessage = await createSystemMessage(conversation._id, sessionId, `${agentName} đã tham gia cuộc trò chuyện`)
  return { statusCode: 200, body: { success: true, data: conversation, systemMessage } }
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

  const systemMessage = await createSystemMessage(conversation._id, sessionId, 'Cuộc trò chuyện đã được đánh dấu giải quyết')
  return { statusCode: 200, body: { success: true, data: conversation, systemMessage } }
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

  const systemMessage = await createSystemMessage(conversation._id, sessionId, 'Cuộc trò chuyện được mở lại')
  return { statusCode: 200, body: { success: true, data: conversation, systemMessage } }
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
