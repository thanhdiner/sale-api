const mongoose = require('mongoose')

const productViewSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    viewerKey: { type: String, required: true },
    viewedAt: { type: Date, default: Date.now }
  },
  { timestamps: false }
)

// Compound index cho query aggregate nhanh
productViewSchema.index({ productId: 1, viewerKey: 1, viewedAt: -1 })

// TTL Index: MongoDB tự động xóa document cũ hơn 30 ngày
productViewSchema.index({ viewedAt: 1 }, { expireAfterSeconds: 30 * 86400 })

const ProductView = mongoose.model('ProductView', productViewSchema, 'productViews')

module.exports = ProductView
