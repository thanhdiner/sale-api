const mongoose = require('mongoose')

const chatMessageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ChatConversation',
      required: true,
      index: true
    },
    sessionId: {
      type: String,
      required: true,
      index: true
    },
    // Loại người gửi
    sender: {
      type: String,
      enum: ['customer', 'agent', 'system', 'bot'],
      required: true
    },
    senderId: { type: String, default: null },
    senderName: { type: String, default: 'Khách' },
    senderAvatar: { type: String, default: null },

    // Loại tin nhắn
    type: {
      type: String,
      enum: ['text', 'system', 'note'], // note = internal, không visible với customer
      default: 'text'
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000
    },
    // Chỉ agent thấy (internal note)
    isInternal: { type: Boolean, default: false },
    isRead: { type: Boolean, default: false },
    // Metadata cho bot messages (suggestions, intent, confidence, pendingAction...)
    metadata: { type: mongoose.Schema.Types.Mixed, default: null }
  },
  { timestamps: true }
)

module.exports = mongoose.model('ChatMessage', chatMessageSchema)
