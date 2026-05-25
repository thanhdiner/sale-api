const mongoose = require('mongoose')

const encryptedSecretSchema = new mongoose.Schema(
  {
    iv: { type: String, default: '' },
    authTag: { type: String, default: '' },
    data: { type: String, default: '' }
  },
  { _id: false }
)

const aiProviderKeySchema = new mongoose.Schema(
  {
    providerCode: { type: String, required: true, trim: true, lowercase: true, index: true },
    alias: { type: String, required: true, trim: true },
    env: { type: String, enum: ['dev', 'production'], default: 'production', index: true },
    encryptedApiKey: { type: encryptedSecretSchema, required: true },
    maskedKey: { type: String, default: '' },
    enabled: { type: Boolean, default: true },
    health: { type: String, enum: ['enabled', 'disabled', 'error', 'quota exceeded', 'rate limited', 'testing'], default: 'enabled' },
    sortOrder: { type: Number, default: 0, index: true },
    weight: { type: Number, default: 20, min: 0, max: 100 },
    requestLimit: { type: Number, default: 10000, min: 0 },
    tokenLimit: { type: Number, default: 5000000, min: 0 },
    requestsToday: { type: Number, default: 0, min: 0 },
    tokensToday: { type: Number, default: 0, min: 0 },
    lastUsed: { type: Date, default: null },
    lastError: { type: String, default: '-' },
    notes: { type: String, default: '' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminAccount', default: null }
  },
  { timestamps: true }
)

module.exports = mongoose.model('AIProviderKey', aiProviderKeySchema, 'aiProviderKeys')
