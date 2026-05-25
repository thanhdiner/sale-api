const mongoose = require('mongoose')

const chatbotRulesHistorySchema = new mongoose.Schema(
  {
    previous: { type: Object, default: {} },
    next: { type: Object, default: {} },
    changedFields: [{ type: String, trim: true }],
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminAccount', default: null }
  },
  { timestamps: true }
)

module.exports = mongoose.model('ChatbotRulesHistory', chatbotRulesHistorySchema, 'chatbotRulesHistory')
