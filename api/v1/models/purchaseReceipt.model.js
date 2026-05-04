const mongoose = require('mongoose')

const purchaseReceiptSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    productName: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitCost: { type: Number, required: true, min: 0 },
    totalCost: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ['active', 'cancelled', 'adjusted'],
      default: 'active',
      index: true
    },
    supplierName: { type: String, default: '' },
    note: { type: String, default: '' },
    translations: {
      en: {
        productName: { type: String, trim: true, default: '' }
      }
    },
    createdBy: {
      by: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminAccount' },
      at: Date
    },
    cancelledBy: {
      by: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminAccount' },
      at: Date,
      reason: { type: String, trim: true, default: '' }
    },
    updatedBy: [
      {
        by: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminAccount' },
        at: Date,
        action: { type: String, enum: ['create', 'cancel', 'update'] },
        before: { type: mongoose.Schema.Types.Mixed, default: null },
        after: { type: mongoose.Schema.Types.Mixed, default: null }
      }
    ]
  },
  { timestamps: true }
)

purchaseReceiptSchema.index({ createdAt: -1 })
purchaseReceiptSchema.index({ status: 1, createdAt: -1 })
purchaseReceiptSchema.index({ productId: 1, status: 1, createdAt: -1 })

module.exports = mongoose.model('PurchaseReceipt', purchaseReceiptSchema, 'purchase_receipts')
