const mongoose = require('mongoose')

const promoCodeSchema = new mongoose.Schema({
  code: { type: String, unique: true, required: true },
  title: { type: String, trim: true, default: '' },
  description: { type: String, default: '' },
  translations: {
    en: {
      title: { type: String, trim: true, default: '' },
      description: { type: String, default: '' }
    }
  },
  category: {
    type: String,
    enum: ['all', 'new', 'flash', 'shipping', 'vip', 'weekend', 'student'],
    default: 'all'
  },
  discountType: { type: String, enum: ['percent', 'amount'], default: 'percent' },
  discountValue: { type: Number, required: true },
  maxDiscount: { type: Number, default: null },
  minOrder: { type: Number, default: 0 },
  applicableProducts: [{ type: String, trim: true }],
  applicableCategories: [{ type: String, trim: true }],
  excludedProducts: [{ type: String, trim: true }],
  usageLimit: { type: Number, default: null },
  usagePerCustomer: { type: Number, default: 1 },
  newCustomersOnly: { type: Boolean, default: false },
  audienceType: {
    type: String,
    enum: ['all_customers', 'new_customers', 'specific_customers', 'customer_groups'],
    default: 'all_customers'
  },
  specificCustomers: [{ type: String, trim: true }],
  customerGroups: [{ type: String, trim: true }],
  usedCount: { type: Number, default: 0 },
  startsAt: { type: Date, default: null },
  expiresAt: { type: Date },
  isActive: { type: Boolean, default: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  usedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  createdAt: { type: Date, default: Date.now }
})

module.exports = mongoose.model('PromoCode', promoCodeSchema, 'promoCodes')
