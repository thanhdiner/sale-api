const mongoose = require('mongoose')

const flashSaleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    translations: {
      en: {
        name: {
          type: String,
          trim: true,
          default: ''
        }
      }
    },
    startAt: {
      type: Date,
      required: true
    },
    endAt: {
      type: Date,
      required: true
    },
    discountPercent: {
      type: Number,
      required: true,
      min: 1,
      max: 90
    },
    maxQuantity: {
      type: Number,
      required: true,
      min: 1
    },
    soldQuantity: {
      type: Number,
      default: 0
    },
    status: {
      type: String,
      enum: ['scheduled', 'active', 'completed'],
      default: 'scheduled'
    },
    products: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
      }
    ],
    revenue: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
)

const FlashSale = mongoose.model('FlashSale', flashSaleSchema, 'flashSales')

module.exports = FlashSale
