const mongoose = require('mongoose')

const WidgetSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    translations: {
      en: {
        title: { type: String, trim: true, default: '' }
      }
    },
    iconUrl: { type: String, required: true },
    link: { type: String, default: '#' },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
)

module.exports = mongoose.model('Widget', WidgetSchema, 'widgets')









