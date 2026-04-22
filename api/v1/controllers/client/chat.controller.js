const cloudinary = require('cloudinary').v2
const streamifier = require('streamifier')

const ChatMessage = require('../../models/chatMessage.model')
const ChatConversation = require('../../models/chatConversation.model')

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
  return ChatMessage.create({
    conversationId,
    sessionId,
    sender: 'system',
    type: 'system',
    senderName: 'System',
    message: text
  })
}

function getUploadFiles(req) {
  return [
    ...(req.files?.images || []),
    ...(req.files?.image || [])
  ].filter(file => file?.buffer)
}

// GET /api/v1/chat/history/:sessionId
const getHistory = async (req, res) => {
  try {
    const { sessionId } = req.params
    const showInternal = req.query.internal === 'true'
    const query = { sessionId }
    if (!showInternal) query.isInternal = { $ne: true }

    const messages = await ChatMessage.find(query).sort({ createdAt: 1 }).limit(200).lean()
    res.json({ success: true, data: messages })
  } catch {
    res.status(500).json({ success: false, message: 'Lỗi server' })
  }
}

// GET /api/v1/chat/conversation/:sessionId
const getConversation = async (req, res) => {
  try {
    const { sessionId } = req.params
    const conv = await ChatConversation.findOne({ sessionId }).lean()
    res.json({ success: true, data: conv })
  } catch {
    res.status(500).json({ success: false, message: 'Lỗi server' })
  }
}

// GET /api/v1/chat/conversations
const getConversations = async (req, res) => {
  try {
    const { status, agentId, limit = 50, skip = 0 } = req.query
    const filter = {}
    if (status) filter.status = status
    if (agentId) filter['assignedAgent.agentId'] = agentId

    const conversations = await ChatConversation.find(filter)
      .sort({ lastMessageAt: -1 })
      .limit(Number(limit))
      .skip(Number(skip))
      .lean()

    res.json({ success: true, data: conversations })
  } catch {
    res.status(500).json({ success: false, message: 'Lỗi server' })
  }
}

// POST /api/v1/chat/upload
const uploadImage = async (req, res) => {
  try {
    const files = getUploadFiles(req)

    if (files.length === 0) {
      return res.status(400).json({ success: false, message: 'Vui lòng chọn ít nhất 1 file ảnh hợp lệ' })
    }

    if (files.length > 10) {
      return res.status(400).json({ success: false, message: 'Tối đa 10 ảnh một lần gửi' })
    }

    const results = await Promise.all(files.map(file => uploadBuffer(file.buffer)))
    const imageUrls = results.map(result => result.secure_url).filter(Boolean)

    if (imageUrls.length === 0) {
      return res.status(500).json({ success: false, message: 'Không thể upload ảnh chat' })
    }

    return res.status(201).json({
      success: true,
      data: {
        imageUrl: imageUrls[0],
        imageUrls
      }
    })
  } catch {
    return res.status(500).json({ success: false, message: 'Không thể upload ảnh chat' })
  }
}

// PATCH /api/v1/chat/assign/:sessionId
const assignConversation = async (req, res) => {
  try {
    const { sessionId } = req.params
    const { agentId, agentName, agentAvatar } = req.body

    const conv = await ChatConversation.findOneAndUpdate(
      { sessionId },
      {
        $set: {
          status: 'open',
          'assignedAgent.agentId': agentId,
          'assignedAgent.agentName': agentName,
          'assignedAgent.agentAvatar': agentAvatar || null,
          'assignedAgent.assignedAt': new Date()
        }
      },
      { new: true }
    )

    if (!conv) return res.status(404).json({ success: false, message: 'Không tìm thấy' })

    await createSystemMessage(conv._id, sessionId, `${agentName} đã tham gia cuộc trò chuyện`)
    return res.json({ success: true, data: conv })
  } catch {
    return res.status(500).json({ success: false, message: 'Lỗi server' })
  }
}

// PATCH /api/v1/chat/resolve/:sessionId
const resolveConversation = async (req, res) => {
  try {
    const { sessionId } = req.params
    const conv = await ChatConversation.findOneAndUpdate(
      { sessionId },
      { $set: { status: 'resolved', resolvedAt: new Date() } },
      { new: true }
    )

    if (!conv) return res.status(404).json({ success: false, message: 'Không tìm thấy' })

    await createSystemMessage(conv._id, sessionId, 'Cuộc trò chuyện đã được đánh dấu giải quyết')
    return res.json({ success: true, data: conv })
  } catch {
    return res.status(500).json({ success: false, message: 'Lỗi server' })
  }
}

// PATCH /api/v1/chat/reopen/:sessionId
const reopenConversation = async (req, res) => {
  try {
    const { sessionId } = req.params
    const conv = await ChatConversation.findOneAndUpdate(
      { sessionId },
      { $set: { status: 'open', resolvedAt: null } },
      { new: true }
    )

    if (!conv) return res.status(404).json({ success: false, message: 'Không tìm thấy' })

    await createSystemMessage(conv._id, sessionId, 'Cuộc trò chuyện được mở lại')
    return res.json({ success: true, data: conv })
  } catch {
    return res.status(500).json({ success: false, message: 'Lỗi server' })
  }
}

// PATCH /api/v1/chat/read/:sessionId
const markRead = async (req, res) => {
  try {
    const { sessionId } = req.params
    const { reader } = req.body

    await ChatMessage.updateMany({ sessionId, isRead: false }, { $set: { isRead: true } })

    const update = reader === 'agent' ? { $set: { unreadByAgent: 0 } } : { $set: { unreadByCustomer: 0 } }
    await ChatConversation.updateOne({ sessionId }, update)

    return res.json({ success: true })
  } catch {
    return res.status(500).json({ success: false, message: 'Lỗi server' })
  }
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
