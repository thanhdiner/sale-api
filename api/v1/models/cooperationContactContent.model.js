const mongoose = require('mongoose')

const buildSeoSchema = () => new mongoose.Schema(
  {
    title: { type: String, trim: true, default: '' },
    description: { type: String, default: '' }
  },
  { _id: false }
)

const buildCooperationContactFields = () => ({
  seo: { type: buildSeoSchema(), default: () => ({}) },
  eyebrow: { type: String, trim: true, default: '' },
  title: { type: String, trim: true, default: '' },
  description: { type: String, default: '' },
  emailLabel: { type: String, trim: true, default: '' },
  phoneLabel: { type: String, trim: true, default: '' },
  email: { type: String, trim: true, default: '' },
  phone: { type: String, trim: true, default: '' },
  note: { type: String, default: '' }
})

const cooperationContactContentSchema = new mongoose.Schema(
  {
    ...buildCooperationContactFields(),
    translations: {
      en: buildCooperationContactFields()
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminAccount', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminAccount', default: null }
  },
  { timestamps: true }
)

module.exports = mongoose.model('CooperationContactContent', cooperationContactContentSchema, 'cooperation_contact_contents')
