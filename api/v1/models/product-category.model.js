const mongoose = require('mongoose')
const slug = require('mongoose-slug-updater')
mongoose.plugin(slug)

const productCategorySchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },
    parent_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ProductCategory',
      default: null
    },
    slug: {
      type: String,
      slug: 'title',
      trim: true
    },
    description: {
      type: String,
      default: ''
    },
    thumbnail: {
      type: String,
      default: ''
    },
    position: {
      type: Number,
      default: 0
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active'
    },
    deleted: {
      type: Boolean,
      default: false
    },
    createdBy: {
      by: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminAccount' },
      at: Date
    },
    deletedBy: {
      by: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminAccount' },
      at: Date
    },
    updateBy: [
      {
        by: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminAccount' },
        at: Date
      }
    ]
  },
  { timestamps: true }
)

productCategorySchema.index({ slug: 1 }, { unique: true })
productCategorySchema.index({ title: 1 }, { unique: true })
productCategorySchema.index({ parent_id: 1, status: 1, deleted: 1 })
productCategorySchema.index({ status: 1, deleted: 1, position: 1 })
productCategorySchema.index({ deleted: 1, status: 1, createdAt: -1 })

const ProductCategory = mongoose.model('ProductCategory', productCategorySchema, 'product_categories')

module.exports = ProductCategory
