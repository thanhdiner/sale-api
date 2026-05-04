const mongoose = require('mongoose')
const slug = require('mongoose-slug-updater')

mongoose.plugin(slug)

const blogCategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120
    },
    slug: {
      type: String,
      slug: 'name',
      unique: true,
      slugPaddingSize: 4,
      trim: true,
      lowercase: true,
      maxlength: 160
    },
    description: {
      type: String,
      default: '',
      trim: true,
      maxlength: 500
    },
    thumbnail: {
      type: String,
      default: '',
      trim: true,
      maxlength: 500
    },
    seo: {
      title: { type: String, default: '', trim: true, maxlength: 180 },
      description: { type: String, default: '', trim: true, maxlength: 300 },
      thumbnail: { type: String, default: '', trim: true, maxlength: 500 }
    },
    translations: {
      en: {
        name: { type: String, default: '', trim: true, maxlength: 120 },
        description: { type: String, default: '', trim: true, maxlength: 500 }
      }
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    sortOrder: {
      type: Number,
      default: 0
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminAccount', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminAccount', default: null }
  },
  { timestamps: true }
)

blogCategorySchema.index({ isActive: 1, sortOrder: 1, name: 1 })

module.exports = mongoose.model('BlogCategory', blogCategorySchema, 'blog_categories')
