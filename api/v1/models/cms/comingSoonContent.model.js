const mongoose = require('mongoose')

const buildSeoSchema = () => new mongoose.Schema(
  {
    title: { type: String, trim: true, default: '' },
    description: { type: String, default: '' }
  },
  { _id: false }
)

const buildComingSoonFields = () => ({
  seo: { type: buildSeoSchema(), default: () => ({}) },
  title: { type: String, trim: true, default: '' },
  description: { type: String, default: '' },
  descriptionSecondLine: { type: String, default: '' },
  status: { type: String, trim: true, default: '' }
})

const comingSoonContentSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      enum: ['community', 'quickSupport', 'license'],
      unique: true,
      index: true
    },
    ...buildComingSoonFields(),
    translations: {
      en: buildComingSoonFields()
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminAccount', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminAccount', default: null }
  },
  { timestamps: true }
)

module.exports = mongoose.model('ComingSoonContent', comingSoonContentSchema, 'coming_soon_contents')









