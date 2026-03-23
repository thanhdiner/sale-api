const mongoose = require('mongoose')

const chatConversationSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    // Trạng thái cuộc trò chuyện
    status: {
      type: String,
      enum: ['unassigned', 'open', 'resolved'],
      default: 'unassigned',
      index: true
    },
    // Thông tin khách hàng
    customer: {
      userId: { type: String, default: null },
      name: { type: String, default: 'Khách ẩn danh' },
      email: { type: String, default: null },
      avatar: { type: String, default: null },
      // Metadata
      userAgent: { type: String, default: null },
      currentPage: { type: String, default: null }
    },
    // Agent được assign
    assignedAgent: {
      agentId: { type: String, default: null },
      agentName: { type: String, default: null },
      agentAvatar: { type: String, default: null },
      assignedAt: { type: Date, default: null }
    },
    // Thống kê
    lastMessage: { type: String, default: '' },
    lastMessageAt: { type: Date, default: null },
    lastMessageSender: { type: String, default: null },
    unreadByAgent: { type: Number, default: 0 },
    unreadByCustomer: { type: Number, default: 0 },
    messageCount: { type: Number, default: 0 },
    // Thời gian
    firstReplyAt: { type: Date, default: null },
    resolvedAt: { type: Date, default: null }
  },
  { timestamps: true }
)

module.exports = mongoose.model('ChatConversation', chatConversationSchema)
