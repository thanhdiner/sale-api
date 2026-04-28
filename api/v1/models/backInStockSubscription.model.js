const mongoose = require('mongoose')

const backInStockSubscriptionSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      maxlength: 100
    },
    status: {
      type: String,
      enum: ['pending', 'notified', 'cancelled'],
      default: 'pending',
      index: true
    },
    requestedAt: {
      type: Date,
      default: Date.now
    },
    notifiedAt: Date,
    productSnapshot: {
      title: { type: String, default: '' },
      slug: { type: String, default: '' }
    }
  },
  { timestamps: true }
)

backInStockSubscriptionSchema.index({ productId: 1, email: 1, status: 1 })
backInStockSubscriptionSchema.index({ status: 1, productId: 1, createdAt: 1 })

module.exports = mongoose.model('BackInStockSubscription', backInStockSubscriptionSchema, 'back_in_stock_subscriptions')
