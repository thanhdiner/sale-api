const mongoose = require('mongoose')

const reviewSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
    rating: { type: Number, required: true, min: 1, max: 5 },
    title: { type: String, trim: true, maxlength: 200, default: '' },
    content: { type: String, trim: true, maxlength: 2000, default: '' },
    images: [{ type: String }],
    videos: [{ type: String }],
    editCount: { type: Number, default: 0 },
    helpfulCount: { type: Number, default: 0 },
    sellerReply: {
      content: { type: String, default: '' },
      translations: {
        en: {
          content: { type: String, default: '' }
        }
      },
      repliedAt: Date
    },
    hidden: { type: Boolean, default: false },
    hiddenAt: Date,
    hiddenBy: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminAccount', default: null },
    hiddenReason: { type: String, trim: true, default: '' },
    deleted: { type: Boolean, default: false },
    deletedAt: Date
  },
  { timestamps: true }
)

reviewSchema.index({ productId: 1, userId: 1, deleted: 1 })
reviewSchema.index({ productId: 1, deleted: 1, hidden: 1 })

module.exports = mongoose.model('Review', reviewSchema)









