const mongoose = require('mongoose')

const quickReplyCategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 80
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 64
    },
    color: {
      type: String,
      trim: true,
      default: '#5e6ad2',
      maxlength: 20
    },
    sortOrder: {
      type: Number,
      default: 0
    },
    isActive: {
      type: Boolean,
      default: true
    },
    isDeleted: {
      type: Boolean,
      default: false
    },
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

quickReplyCategorySchema.index({ isDeleted: 1, isActive: 1, sortOrder: 1, name: 1 })
quickReplyCategorySchema.index(
  { slug: 1, isDeleted: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } }
)

module.exports = mongoose.model('QuickReplyCategory', quickReplyCategorySchema, 'quick_reply_categories')









