const mongoose = require('mongoose')
const slug = require('mongoose-slug-updater')

mongoose.plugin(slug)

const blogTagSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    slug: { type: String, slug: 'name', unique: true, slugPaddingSize: 4, trim: true, lowercase: true, maxlength: 120 },
    translations: {
      en: {
        name: { type: String, default: '', trim: true, maxlength: 80 },
        slug: { type: String, default: '', trim: true, lowercase: true, maxlength: 120 }
      }
    },
    status: { type: String, enum: ['active', 'inactive'], default: 'active', index: true },
    deleted: { type: Boolean, default: false, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminAccount', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminAccount', default: null }
  },
  { timestamps: true }
)

blogTagSchema.index({ deleted: 1, status: 1, name: 1 })

module.exports = mongoose.model('BlogTag', blogTagSchema, 'blog_tags')









