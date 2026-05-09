const mongoose = require('mongoose')

const blogAgentLogSchema = new mongoose.Schema(
  {
    batchId: {
      type: String,
      default: '',
      trim: true,
      index: true
    },
    action: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    status: {
      type: String,
      enum: ['success', 'failed', 'skipped'],
      required: true,
      index: true
    },
    blogPost: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BlogPost',
      default: null
    },
    provider: {
      type: String,
      default: '',
      trim: true
    },
    model: {
      type: String,
      default: '',
      trim: true
    },
    topic: {
      type: String,
      default: '',
      trim: true
    },
    input: {
      type: Object,
      default: {}
    },
    output: {
      type: Object,
      default: {}
    },
    reason: {
      type: String,
      default: '',
      trim: true
    },
    error: {
      type: String,
      default: '',
      trim: true
    }
  },
  { timestamps: true }
)

blogAgentLogSchema.index({ createdAt: -1 })
blogAgentLogSchema.index({ batchId: 1, createdAt: -1 })

module.exports = mongoose.model('BlogAgentLog', blogAgentLogSchema, 'blog_agent_logs')









