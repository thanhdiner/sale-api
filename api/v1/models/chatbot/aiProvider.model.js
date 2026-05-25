const mongoose = require('mongoose')

const aiProviderModelSchema = new mongoose.Schema(
  {
    model: { type: String, required: true, trim: true },
    displayName: { type: String, default: '', trim: true },
    enabled: { type: Boolean, default: true },
    supportsTools: { type: Boolean, default: true },
    supportsVision: { type: Boolean, default: false },
    supportsJsonMode: { type: Boolean, default: true },
    supportsStreaming: { type: Boolean, default: true },
    contextWindow: { type: Number, default: 0, min: 0 },
    maxOutputTokens: { type: Number, default: 0, min: 0 },
    costLevel: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    speedLevel: { type: String, enum: ['slow', 'medium', 'fast'], default: 'medium' }
  },
  { _id: false }
)

const aiProviderSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, trim: true, lowercase: true },
    providerKind: { type: String, enum: ['built-in', 'custom'], default: 'custom' },
    adapter: {
      type: String,
      enum: ['openai-compatible', 'anthropic-compatible', 'gemini-compatible', 'custom-http'],
      default: 'openai-compatible'
    },
    baseUrl: { type: String, required: true, trim: true },
    defaultModel: { type: String, required: true, trim: true },
    allowedModels: [{ type: String, trim: true }],
    models: { type: [aiProviderModelSchema], default: [] },
    enabled: { type: Boolean, default: true },
    health: { type: String, enum: ['healthy', 'failed', 'disabled', 'testing'], default: 'healthy' },
    timeoutMs: { type: Number, default: 30000, min: 1000 },
    maxRetries: { type: Number, default: 3, min: 0, max: 10 },
    headers: { type: Map, of: String, default: {} },
    description: { type: String, default: '' },
    notes: { type: String, default: '' },
    lastTested: { type: Date, default: null },
    lastError: { type: String, default: '-' },
    keyStrategy: { type: String, enum: ['weighted'], default: 'weighted' },
    keyEnv: { type: String, enum: ['dev', 'production'], default: 'production' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminAccount', default: null }
  },
  { timestamps: true }
)

module.exports = mongoose.model('AIProvider', aiProviderSchema, 'aiProviders')
