const mongoose = require('mongoose')
const slug = require('mongoose-slug-updater')
mongoose.plugin(slug)

const productCategorySchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    parent_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ProductCategory',
      default: null
    },
    slug: {
      type: String,
      unique: true,
      slug: 'title'
    },
    description: String,
    thumbnail: String,
    position: Number,
    status: String,
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

const ProductCategory = mongoose.model('ProductCategory', productCategorySchema, 'product_categories')
module.exports = ProductCategory
