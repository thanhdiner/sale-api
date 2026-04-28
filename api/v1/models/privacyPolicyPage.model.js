const mongoose = require('mongoose')

const privacyPolicyPageSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      default: 'privacy-policy',
      unique: true,
      index: true
    },
    content: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    translations: {
      en: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
      }
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminAccount',
      default: null
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminAccount',
      default: null
    }
  },
  { timestamps: true }
)

module.exports = mongoose.model('PrivacyPolicyPage', privacyPolicyPageSchema, 'privacyPolicyPages')
