const mongoose = require('mongoose')

const aiRuntimeSettingsSchema = new mongoose.Schema(
  {
    activeProviderCode: { type: String, default: 'openai', trim: true, lowercase: true },
    activeModel: { type: String, default: 'gpt-4o-mini', trim: true },
    fallbackProviderCodes: [{ type: String, trim: true, lowercase: true }],
    timeoutMs: { type: Number, default: 30000, min: 1000 },
    maxRetries: { type: Number, default: 3, min: 0, max: 10 },
    temperature: { type: Number, default: 0.7, min: 0, max: 2 },
    maxTokens: { type: Number, default: 1000, min: 1 },
    enabled: { type: Boolean, default: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminAccount', default: null }
  },
  { timestamps: true }
)

module.exports = mongoose.model('AIRuntimeSettings', aiRuntimeSettingsSchema, 'aiRuntimeSettings')
