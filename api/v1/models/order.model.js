const mongoose = require('mongoose')

const OrderSchema = new mongoose.Schema(
  {
    contact: {
      firstName: { type: String, required: true },
      lastName: { type: String, required: true },
      firstNameNoAccent: { type: String },
      lastNameNoAccent: { type: String },
      phone: { type: String, required: true },
      email: { type: String },
      notes: { type: String }
    },
    orderItems: [
      {
        productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
        name: { type: String, required: true },
        image: { type: String },
        price: { type: Number, required: true },
        costPrice: { type: Number, default: 0 },
        originalPrice: { type: Number },
        salePrice: { type: Number },
        isFlashSale: { type: Boolean },
        discountPercentage: { type: Number },
        flashSaleId: { type: mongoose.Schema.Types.ObjectId, ref: 'FlashSale' },
        quantity: { type: Number, required: true },
        category: { type: String }
      }
    ],

    deliveryMethod: { type: String, enum: ['pickup', 'contact'], required: true },
    paymentMethod: { type: String, enum: ['transfer', 'contact', 'vnpay', 'momo', 'zalopay'], required: true },
    paymentStatus: { type: String, enum: ['pending', 'paid', 'failed'], default: 'pending' },
    paymentTransactionId: { type: String },
    subtotal: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    shipping: { type: Number, default: 0 },
    total: { type: Number, required: true },

    promo: { type: String },

    status: {
      type: String,
      enum: ['pending', 'confirmed', 'shipping', 'completed', 'cancelled'],
      default: 'pending'
    },

    transferInfo: {
      bank: { type: String },
      accountNumber: { type: String },
      accountName: { type: String },
      content: { type: String }
    },
    isDeleted: { type: Boolean, default: false },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  {
    timestamps: true
  }
)

module.exports = mongoose.model('Order', OrderSchema, 'orders')
