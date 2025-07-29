const mongoose = require('mongoose')
const slug = require('mongoose-slug-updater')
mongoose.plugin(slug)

const productSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },
    titleNoAccent: { type: String, required: true },
    productCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ProductCategory',
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
    isTopDeal: { type: Boolean, default: false },
    isFeatured: { type: Boolean, default: false },
    rate: Number,
    deliveryEstimateDays: { type: Number, default: 0, min: 0 },
    slug: {
      type: String,
      unique: true
      // slug: 'title', //# tự động get slug từ field title
    },
    createdBy: {
      by: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminAccount' },
      at: Date
    },
    deleted: {
      type: Boolean,
      default: false
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

const Product = mongoose.model('Product', productSchema, 'products')

module.exports = Product
