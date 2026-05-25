const mongoose = require('mongoose')

const aiProviderKeySettingSchema = new mongoose.Schema(
  {
    strategy: { type: String, enum: ['round-robin', 'least-used', 'weighted'], default: 'weighted' },
    roundRobinEnabled: { type: Boolean, default: false },
    stickyCount: { type: Number, default: 1, min: 1, max: 1000 },
    roundRobinCursor: { type: Number, default: 0 },
    stickyHits: { type: Number, default: 0 },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminAccount', default: null }
  },
  { timestamps: true }
)

module.exports = mongoose.model('AIProviderKeySetting', aiProviderKeySettingSchema, 'aiProviderKeySettings')
