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
      type: String,
      default: ''
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
      account_id: String,
      createAt: {
        type: Date,
        default: Date.now
      }
    },
    deletedBy: {
      account_id: String,
      deletedAt: Date
    },
    updateBy: [
      {
        account_id: String,
        updatedAt: Date
      }
    ]
  },
  { timestamps: true }
)

const ProductCategory = mongoose.model('ProductCategory', productCategorySchema, 'product_categories')
module.exports = ProductCategory
