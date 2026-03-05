const mongoose = require('mongoose')

const reviewSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    title: { type: String, trim: true, maxlength: 200, default: '' },
    content: { type: String, trim: true, maxlength: 2000, default: '' },
    images: [{ type: String }],
    videos: [{ type: String }],
    helpfulCount: { type: Number, default: 0 },
    sellerReply: {
      content: { type: String, default: '' },
      repliedAt: Date
    },
    deleted: { type: Boolean, default: false },
    deletedAt: Date
  },
  { timestamps: true }
)

module.exports = mongoose.model('Review', reviewSchema)
