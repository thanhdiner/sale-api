const mongoose = require('mongoose')

const generateOrderCode = () => `SM${Date.now()}${Math.floor(1000 + Math.random() * 9000)}`

const returnRefundItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    productQuery: { type: String, trim: true },
    name: { type: String, trim: true },
    quantity: { type: Number },
    reason: { type: String, trim: true }
  },
  { _id: false }
)

const returnRefundSchema = new mongoose.Schema(
  {
    requestType: {
      type: String,
      enum: ['return', 'refund', 'exchange', 'return_refund']
    },
    preferredResolution: {
      type: String,
      enum: ['refund', 'exchange', 'store_credit', 'repair', 'support']
    },
    status: {
      type: String,
      enum: ['requested', 'under_review', 'approved', 'rejected', 'processing', 'completed', 'cancelled'],
      default: 'requested'
    },
    refundStatus: {
      type: String,
      enum: ['not_applicable', 'requested', 'under_review', 'approved', 'processing', 'completed', 'rejected', 'cancelled'],
      default: 'not_applicable'
    },
    exchangeStatus: {
      type: String,
      enum: ['not_applicable', 'requested', 'under_review', 'approved', 'processing', 'completed', 'rejected', 'cancelled'],
      default: 'not_applicable'
    },
    ticketId: { type: String, trim: true },
    reason: { type: String, trim: true },
    details: { type: String, trim: true },
    items: [returnRefundItemSchema],
    requestedAt: { type: Date },
    updatedAt: { type: Date },
    resolvedAt: { type: Date },
    source: { type: String, trim: true },
    priority: { type: String, trim: true }
  },
  { _id: false }
)

const OrderSchema = new mongoose.Schema(
  {
    orderCode: { type: String, trim: true, default: generateOrderCode },
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
    paymentMethod: { type: String, enum: ['transfer', 'contact', 'vnpay', 'momo', 'zalopay', 'sepay'], required: true },
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

    returnRefund: { type: returnRefundSchema, default: undefined },

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
OrderSchema.index({ orderCode: 1 }, { unique: true, sparse: true })
OrderSchema.index({ 'returnRefund.ticketId': 1 }, { sparse: true })

module.exports = mongoose.model('Order', OrderSchema, 'orders')









