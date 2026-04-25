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
      addressLine1: { type: String },
      provinceCode: { type: String },
      provinceName: { type: String },
      districtCode: { type: String },
      districtName: { type: String },
      wardCode: { type: String },
      wardName: { type: String },
      address: { type: String },
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
        category: { type: String },
        deliveryType: { type: String, enum: ['manual', 'instant_account'], default: 'manual' },
        deliveryInstructions: { type: String, default: '' },
        credentialIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ProductCredential' }],
        digitalDeliveries: [
          {
            credentialId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductCredential' },
            username: String,
            password: String,
            email: String,
            licenseKey: String,
            loginUrl: String,
            notes: String,
            instructions: String,
            deliveredAt: Date
          }
        ]
      }
    ],

    deliveryMethod: { type: String, enum: ['pickup', 'contact'], required: true },
    paymentMethod: { type: String, enum: ['transfer', 'contact', 'vnpay', 'momo', 'zalopay'], required: true },
    paymentStatus: { type: String, enum: ['pending', 'paid', 'failed'], default: 'pending' },
    paymentTransactionId: { type: String },
    reservationExpiresAt: { type: Date },
    paymentExpiredAt: { type: Date },
    cancelledAt: { type: Date },
    promoApplied: { type: Boolean, default: false },
    stockApplied: { type: Boolean, default: false },
    hasDigitalDelivery: { type: Boolean, default: false },
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

OrderSchema.index({ isDeleted: 1, status: 1, createdAt: -1 })
OrderSchema.index({ userId: 1, createdAt: -1 })
OrderSchema.index({ isDeleted: 1, createdAt: -1 })
OrderSchema.index({ createdAt: -1 })
OrderSchema.index({ status: 1, paymentStatus: 1, createdAt: -1 })

module.exports = mongoose.model('Order', OrderSchema, 'orders')
