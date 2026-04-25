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
    costPrice: {
      type: Number,
      min: 0,
      default: 0
    },
    discountPercentage: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },
    stock: {
      type: Number,
      min: 0,
      default: 0
    },
    soldQuantity: {
      type: Number,
      default: 0
    },
    thumbnail: {
      type: String,
      default: ''
    },
    images: {
      type: [String],
      default: []
    },
    features: {
      type: [String],
      default: []
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active'
    },
    position: Number,
    content: String,
    timeStart: Date,
    timeFinish: Date,
    isTopDeal: { type: Boolean, default: false },
    isFeatured: { type: Boolean, default: false },
    rate: {
      type: Number,
      min: 0,
      max: 5,
      default: 0
    },
    deliveryEstimateDays: { type: Number, default: 0, min: 0 },
    deliveryType: {
      type: String,
      enum: ['manual', 'instant_account'],
      default: 'manual'
    },
    deliveryInstructions: {
      type: String,
      default: ''
    },
    viewsCount: { type: Number, default: 0 },
    recommendScore: { type: Number, default: 0 },
    slug: {
      type: String,
      trim: true
      // slug: 'title',
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

productSchema.index({ slug: 1 }, { unique: true })
productSchema.index({ productCategory: 1, status: 1, deleted: 1 })
productSchema.index({ status: 1, deleted: 1, createdAt: -1 })
productSchema.index({ deleted: 1, status: 1, createdAt: -1 })
productSchema.index({ isFeatured: 1, status: 1, deleted: 1 })
productSchema.index({ isTopDeal: 1, status: 1, deleted: 1 })
productSchema.index({ deleted: 1, isTopDeal: 1, soldQuantity: -1 })
productSchema.index({ deleted: 1, productCategory: 1 })
productSchema.index({ status: 1, deleted: 1, recommendScore: -1 })

const Product = mongoose.model('Product', productSchema, 'products')

module.exports = Product
