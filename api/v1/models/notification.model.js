const mongoose = require('mongoose')

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    type: {
      type: String,
      trim: true,
      default: 'system'
    },
    category: {
      type: String,
      enum: ['orders', 'payments', 'promotions', 'system', 'support', 'account', 'wishlist', 'reviews', 'chat'],
      default: 'system'
    },
    title: {
      type: String,
      trim: true,
      required: true
    },
    body: {
      type: String,
      trim: true,
      default: ''
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      default: null
    },
    targetType: {
      type: String,
      trim: true,
      default: ''
    },
    targetId: {
      type: String,
      trim: true,
      default: ''
    },
    data: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    readAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
)

notificationSchema.index({ userId: 1, readAt: 1, createdAt: -1 })
notificationSchema.index({ userId: 1, category: 1, createdAt: -1 })
notificationSchema.index({ userId: 1, orderId: 1, createdAt: -1 })

module.exports = mongoose.model('Notification', notificationSchema, 'notifications')
