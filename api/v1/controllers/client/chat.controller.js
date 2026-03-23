const ChatMessage = require('../../models/chatMessage.model')
const ChatConversation = require('../../models/chatConversation.model')

// ─── Helper: tạo system message ──────────────────────────────────────────────
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

// GET /api/v1/chat/history/:sessionId
const getHistory = async (req, res) => {
  try {
    const { sessionId } = req.params
    const showInternal = req.query.internal === 'true' // agent mới thấy
    const query = { sessionId }
    if (!showInternal) query.isInternal = { $ne: true }

    const messages = await ChatMessage
      .find(query)
      .sort({ createdAt: 1 })
      .limit(200)
      .lean()
    res.json({ success: true, data: messages })
  } catch {
    res.status(500).json({ success: false, message: 'Lỗi server' })
  }
}

// GET /api/v1/chat/conversation/:sessionId  (lấy hoặc tạo conversation)
const getConversation = async (req, res) => {
  try {
    const { sessionId } = req.params
    let conv = await ChatConversation.findOne({ sessionId }).lean()
    res.json({ success: true, data: conv })
  } catch {
    res.status(500).json({ success: false, message: 'Lỗi server' })
  }
}

// GET /api/v1/chat/conversations  (admin/agent — lấy danh sách)
const getConversations = async (req, res) => {
  try {
    const { status, agentId, limit = 50, skip = 0 } = req.query
    const filter = {}
    if (status) filter.status = status
    if (agentId) filter['assignedAgent.agentId'] = agentId

    const conversations = await ChatConversation
      .find(filter)
      .sort({ lastMessageAt: -1 })
      .limit(Number(limit))
      .skip(Number(skip))
      .lean()

    res.json({ success: true, data: conversations })
  } catch {
    res.status(500).json({ success: false, message: 'Lỗi server' })
  }
}

// PATCH /api/v1/chat/assign/:sessionId  (agent nhận conversation)
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
    res.json({ success: true, data: conv })
  } catch {
    res.status(500).json({ success: false, message: 'Lỗi server' })
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
    res.json({ success: true, data: conv })
  } catch {
    res.status(500).json({ success: false, message: 'Lỗi server' })
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
    res.json({ success: true, data: conv })
  } catch {
    res.status(500).json({ success: false, message: 'Lỗi server' })
  }
}

// PATCH /api/v1/chat/read/:sessionId
const markRead = async (req, res) => {
  try {
    const { sessionId } = req.params
    const { reader } = req.body // 'agent' hoặc 'customer'
    await ChatMessage.updateMany(
      { sessionId, isRead: false },
      { $set: { isRead: true } }
    )
    const update = reader === 'agent'
      ? { $set: { unreadByAgent: 0 } }
      : { $set: { unreadByCustomer: 0 } }
    await ChatConversation.updateOne({ sessionId }, update)
    res.json({ success: true })
  } catch {
    res.status(500).json({ success: false, message: 'Lỗi server' })
  }
}

module.exports = {
  getHistory,
  getConversation,
  getConversations,
  assignConversation,
  resolveConversation,
  reopenConversation,
  markRead
}
