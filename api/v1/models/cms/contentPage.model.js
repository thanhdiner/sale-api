const mongoose = require('mongoose')

const contentPageSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      index: true
    },
    content: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    translations: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
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
  {
    minimize: false,
    timestamps: true
  }
)

module.exports = mongoose.model('ContentPage', contentPageSchema, 'content_pages')









