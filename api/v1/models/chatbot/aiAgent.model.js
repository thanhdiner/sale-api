const mongoose = require('mongoose')

const aiAgentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, trim: true, lowercase: true },
    description: { type: String, default: '' },
    avatar: { type: String, default: '' },
    color: { type: String, default: '#5e6ad2' },
    locale: { type: String, default: 'vi', enum: ['vi', 'en'] },
    providerCode: { type: String, required: true, trim: true, lowercase: true },
    model: { type: String, required: true, trim: true },
    systemPrompt: { type: String, default: '' },
    greeting: { type: String, default: '' },
    fallbackMessage: { type: String, default: '' },
    temperature: { type: Number, default: 0.7, min: 0, max: 2 },
    topP: { type: Number, default: 1, min: 0, max: 1 },
    maxTokens: { type: Number, default: 1000, min: 1 },
    stopSequences: [{ type: String, trim: true }],
    toolIds: [{ type: String, trim: true }],
    enabled: { type: Boolean, default: true },
    isDefault: { type: Boolean, default: false },
    sortOrder: { type: Number, default: 0, index: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminAccount', default: null }
  },
  { timestamps: true }
)

module.exports = mongoose.model('AIAgent', aiAgentSchema, 'aiAgents')
