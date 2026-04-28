const mongoose = require('mongoose')

const quickReplySchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 140
    },
    category: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 64
    },
    shortcut: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 64
    },
    content: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 2000
    },
    variables: [{
      type: String,
      trim: true,
      maxlength: 40
    }],
    language: {
      type: String,
      enum: ['vi', 'en'],
      default: 'vi'
    },
    isActive: {
      type: Boolean,
      default: true
    },
    isDeleted: {
      type: Boolean,
      default: false
    },
    usageCount: {
      type: Number,
      default: 0,
      min: 0
    },
    usageThisMonth: {
      type: Number,
      default: 0,
      min: 0
    },
    usageMonthKey: {
      type: String,
      default: ''
    },
    lastUsedAt: Date,
    createdBy: {
      accountId: String,
      name: String
    },
    updatedBy: {
      accountId: String,
      name: String
    },
    deletedAt: Date
  },
  { timestamps: true }
)

quickReplySchema.index({ isDeleted: 1, isActive: 1, category: 1, language: 1, updatedAt: -1 })
quickReplySchema.index(
  { shortcut: 1, language: 1, isDeleted: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } }
)

module.exports = mongoose.model('QuickReply', quickReplySchema, 'quick_replies')
