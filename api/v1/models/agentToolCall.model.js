const mongoose = require('mongoose')

const agentToolCallSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ChatConversation',
      default: null,
      index: true
    },
    sessionId: {
      type: String,
      required: true,
      index: true
    },
    userId: {
      type: String,
      default: null,
      index: true
    },
    toolName: {
      type: String,
      required: true,
      index: true
    },
    toolLabel: {
      type: String,
      default: ''
    },
    toolArgs: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    triggerMessage: {
      type: String,
      default: ''
    },
    resultPreview: {
      type: String,
      default: ''
    },
    resultPayload: {
      type: String,
      default: ''
    },
    outcome: {
      type: String,
      enum: ['success', 'not_found', 'error'],
      default: 'success'
    },
    durationMs: {
      type: Number,
      default: 0
    },
    provider: {
      type: String,
      default: null
    },
    model: {
      type: String,
      default: null
    },
    round: {
      type: Number,
      default: 1
    }
  },
  { timestamps: true }
)

module.exports = mongoose.model('AgentToolCall', agentToolCallSchema)
