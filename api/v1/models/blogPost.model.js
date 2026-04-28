const mongoose = require('mongoose')

const translationSchema = new mongoose.Schema(
  {
    title: { type: String, trim: true, default: '', maxlength: 180 },
    excerpt: { type: String, trim: true, default: '', maxlength: 500 },
    content: { type: String, default: '', maxlength: 20000 },
    category: { type: String, trim: true, default: '', maxlength: 80 },
    tags: { type: [String], default: [] }
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
    tags: { type: [String], default: [] },
    translations: {
      en: { type: translationSchema, default: () => ({}) }
    },
    status: {
      type: String,
      enum: ['draft', 'published'],
      default: 'draft'
    },
    isFeatured: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
    publishedAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminAccount', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminAccount', default: null }
  },
  { timestamps: true }
)

blogPostSchema.index({ slug: 1 }, { unique: true, partialFilterExpression: { isDeleted: false } })
blogPostSchema.index({ status: 1, isDeleted: 1, publishedAt: -1 })
blogPostSchema.index({ isFeatured: 1, status: 1, isDeleted: 1 })

module.exports = mongoose.model('BlogPost', blogPostSchema, 'blog_posts')
