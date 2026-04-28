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
    // Loai nguoi gui
    sender: {
      type: String,
      enum: ['customer', 'agent', 'system', 'bot'],
      required: true
    },
    senderId: { type: String, default: null },
    senderName: { type: String, default: 'Khách' },
    senderAvatar: { type: String, default: null },

    // Loai tin nhan
    type: {
      type: String,
      enum: ['text', 'image', 'system', 'note'],
      default: 'text'
    },
    message: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: '',
      validate: {
        validator(value) {
          if (this.type === 'image') return !!this.imageUrl || (Array.isArray(this.imageUrls) && this.imageUrls.length > 0)
          return typeof value === 'string' && value.trim().length > 0
        },
        message: 'Nội dung tin nhắn không hợp lệ'
      }
    },
    imageUrl: { type: String, default: null },
    imageUrls: { type: [String], default: [] },
    // Chi agent thay (internal note)
    isInternal: { type: Boolean, default: false },
    isRead: { type: Boolean, default: false },
    translations: {
      en: {
        message: { type: String, trim: true, maxlength: 2000, default: '' }
      }
    },
    reactions: {
      type: [
        {
          emoji: { type: String, required: true, trim: true, maxlength: 12 },
          reactorType: {
            type: String,
            enum: ['customer', 'agent'],
            required: true
          },
          reactorId: { type: String, default: null, maxlength: 200 },
          reactorName: { type: String, default: '', trim: true, maxlength: 100 },
          createdAt: { type: Date, default: Date.now }
        }
      ],
      default: []
    },
    // Metadata cho bot messages (suggestions, intent, confidence, pendingAction...)
    metadata: { type: mongoose.Schema.Types.Mixed, default: null }
  },
  { timestamps: true }
)

module.exports = mongoose.model('ChatMessage', chatMessageSchema)
