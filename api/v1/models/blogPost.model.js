const mongoose = require('mongoose')

const translationSchema = new mongoose.Schema(
  {
    title: { type: String, trim: true, default: '', maxlength: 180 },
    excerpt: { type: String, trim: true, default: '', maxlength: 500 },
    content: { type: String, default: '', maxlength: 20000 },
    category: { type: String, trim: true, default: '', maxlength: 80 },
    tags: { type: [String], default: [] },
    seoTitle: { type: String, trim: true, default: '', maxlength: 180 },
    seoDescription: { type: String, trim: true, default: '', maxlength: 300 }
  },
  { _id: false }
)

const blogPostSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 180 },
    slug: { type: String, required: true, trim: true, lowercase: true, maxlength: 220 },
    excerpt: { type: String, trim: true, default: '', maxlength: 500 },
    content: { type: String, default: '', maxlength: 20000 },
    thumbnail: { type: String, trim: true, default: '', maxlength: 500 },
    category: { type: String, trim: true, default: '', maxlength: 80 },
    categoryRef: { type: mongoose.Schema.Types.ObjectId, ref: 'BlogCategory', default: null },
    tags: { type: [String], default: [] },
    tagIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'BlogTag' }],
    relatedProducts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
    translations: {
      en: { type: translationSchema, default: () => ({}) }
    },
    seo: {
      title: { type: String, trim: true, default: '', maxlength: 180 },
      description: { type: String, trim: true, default: '', maxlength: 300 },
      keywords: { type: [String], default: [] },
      canonicalUrl: { type: String, trim: true, default: '', maxlength: 500 }
    },
    source: {
      type: String,
      enum: ['manual', 'ai'],
      default: 'manual',
      index: true
    },
    status: {
      type: String,
      enum: ['draft', 'queued', 'published', 'archived'],
      default: 'draft'
    },
    reviewStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'needs_edit'],
      default: 'pending',
      index: true
    },
    autoPublish: {
      enabled: { type: Boolean, default: false },
      priority: { type: Number, default: 0 },
      publishAfter: { type: Date, default: null },
      publishBefore: { type: Date, default: null },
      approvedAt: { type: Date, default: null },
      approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminAccount', default: null },
      scheduleGroup: { type: String, trim: true, default: 'default', maxlength: 80 }
    },
    ai: {
      generatedByAI: { type: Boolean, default: false },
      batchId: { type: String, trim: true, default: '', index: true },
      topic: { type: String, trim: true, default: '', maxlength: 220 },
      prompt: { type: String, default: '' },
      provider: { type: String, trim: true, default: '', maxlength: 80 },
      model: { type: String, trim: true, default: '', maxlength: 120 },
      qualityScore: { type: Number, default: 0 },
      duplicateRisk: {
        type: String,
        enum: ['low', 'medium', 'high'],
        default: 'low'
      },
      factCheckStatus: {
        type: String,
        enum: ['pending', 'passed', 'failed'],
        default: 'pending'
      },
      generatedAt: { type: Date, default: null }
    },
    isFeatured: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
    viewsCount: { type: Number, default: 0 },
    scheduledAt: { type: Date, default: null, index: true },
    publishedAt: { type: Date, default: null },
    publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminAccount', default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminAccount', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminAccount', default: null }
  },
  { timestamps: true }
)

blogPostSchema.index({ slug: 1 }, { unique: true, partialFilterExpression: { isDeleted: false } })
blogPostSchema.index({ status: 1, isDeleted: 1, publishedAt: -1 })
blogPostSchema.index({ isFeatured: 1, status: 1, isDeleted: 1 })
blogPostSchema.index({ status: 1, reviewStatus: 1, scheduledAt: 1, publishedAt: 1 })
blogPostSchema.index({ 'autoPublish.enabled': 1, 'autoPublish.priority': -1, 'autoPublish.approvedAt': 1 })
blogPostSchema.index({ categoryRef: 1, status: 1, isDeleted: 1 })
blogPostSchema.index({ tagIds: 1, status: 1, isDeleted: 1 })

module.exports = mongoose.model('BlogPost', blogPostSchema, 'blog_posts')
