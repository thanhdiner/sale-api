const mongoose = require('mongoose')

const encryptedCredentialSchema = new mongoose.Schema(
  {
    iv: { type: String, required: true },
    authTag: { type: String, required: true },
    data: { type: String, required: true }
  },
  { _id: false }
)

const productCredentialSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true
    },
    status: {
      type: String,
      enum: ['available', 'reserved', 'sold', 'disabled'],
      default: 'available',
      index: true
    },
    credential: {
      type: encryptedCredentialSchema,
      required: true
    },
    summary: {
      username: String,
      email: String,
      licenseKey: String,
      loginUrl: String,
      hasPassword: { type: Boolean, default: false },
      hasNotes: { type: Boolean, default: false }
    },
    reservedByOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    soldToOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    reservedAt: Date,
    soldAt: Date,
    disabledAt: Date,
    createdBy: {
      by: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminAccount' },
      at: Date
    },
    updatedBy: [
      {
        by: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminAccount' },
        at: Date
      }
    ]
  },
  { timestamps: true }
)

productCredentialSchema.index({ productId: 1, status: 1, createdAt: 1 })
productCredentialSchema.index({ reservedByOrderId: 1 })
productCredentialSchema.index({ soldToOrderId: 1 })

module.exports = mongoose.model('ProductCredential', productCredentialSchema, 'product_credentials')
