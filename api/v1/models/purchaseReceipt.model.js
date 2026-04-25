const mongoose = require('mongoose')

const purchaseReceiptSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    productName: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitCost: { type: Number, required: true, min: 0 },
    totalCost: { type: Number, required: true, min: 0 },
    supplierName: { type: String, default: '' },
    note: { type: String, default: '' },
    createdBy: {
      by: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminAccount' },
      at: Date
    }
  },
  { timestamps: true }
)

purchaseReceiptSchema.index({ createdAt: -1 })

module.exports = mongoose.model('PurchaseReceipt', purchaseReceiptSchema, 'purchase_receipts')
