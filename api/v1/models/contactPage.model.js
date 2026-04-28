const mongoose = require('mongoose')

const contactPageSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      default: 'contact-page',
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

module.exports = mongoose.model('ContactPage', contactPageSchema, 'contactPages')
