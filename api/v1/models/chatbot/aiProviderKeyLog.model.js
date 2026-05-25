const mongoose = require('mongoose')

const aiProviderKeyLogSchema = new mongoose.Schema(
  {
    providerCode: { type: String, required: true, trim: true, lowercase: true, index: true },
    keyId: { type: mongoose.Schema.Types.ObjectId, ref: 'AIProviderKey', default: null },
    maskedKey: { type: String, default: '' },
    model: { type: String, default: '' },
    type: { type: String, default: 'chatbot' },
    tokens: { type: Number, default: 0 },
    status: { type: String, enum: ['success', 'retry', 'failed'], default: 'success' },
    retry: { type: String, enum: ['yes', 'no'], default: 'no' },
    error: { type: String, default: '-' }
  },
  { timestamps: true }
)

module.exports = mongoose.model('AIProviderKeyLog', aiProviderKeyLogSchema, 'aiProviderKeyLogs')
