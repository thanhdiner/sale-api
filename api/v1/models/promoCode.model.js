const mongoose = require('mongoose')

const promoCodeSchema = new mongoose.Schema({
  code: { type: String, unique: true, required: true },
  discountType: { type: String, enum: ['percent', 'amount'], default: 'percent' },
  discountValue: { type: Number, required: true },
  maxDiscount: { type: Number, default: null },
  minOrder: { type: Number, default: 0 },
  usageLimit: { type: Number, default: null },
  usedCount: { type: Number, default: 0 },
  expiresAt: { type: Date },
  isActive: { type: Boolean, default: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  usedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  createdAt: { type: Date, default: Date.now }
})

module.exports = mongoose.model('PromoCode', promoCodeSchema, 'promoCodes')
