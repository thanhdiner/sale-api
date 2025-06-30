const mongoose = require('mongoose')
const slug = require('mongoose-slug-updater')
mongoose.plugin(slug)

const productSchema = new mongoose.Schema(
  {
    title: String,
    productCategory: {
      type: String,
      required: true
    },
    description: String,
    price: {
      type: Number,
      required: true,
      min: 0
    },
    discountPercentage: Number,
    stock: {
      type: Number,
      min: 0
    },
    thumbnail: String,
    status: String,
    position: Number,
    content: String,
    timeStart: Date,
    timeFinish: Date,
    rate: Number,
    slug: {
      type: String,
      unique: true
      // slug: 'title', //# tự động get slug từ field title
    },
    createdBy: {
      account_id: String,
      createAt: {
        type: Date,
        default: Date.now
      }
    },
    deleted: {
      type: Boolean,
      default: false
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

const Product = mongoose.model('Product', productSchema, 'products')

module.exports = Product
