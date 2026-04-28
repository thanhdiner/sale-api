const mongoose = require('mongoose')

const buildSeoSchema = () => new mongoose.Schema(
  {
    title: { type: String, trim: true, default: '' },
    description: { type: String, default: '' }
  },
  { _id: false }
)

const buildGameAccountFields = () => ({
  seo: { type: buildSeoSchema(), default: () => ({}) },
  eyebrow: { type: String, trim: true, default: '' },
  title: { type: String, trim: true, default: '' },
  description: { type: String, default: '' },
  note: { type: String, default: '' }
})

const gameAccountContentSchema = new mongoose.Schema(
  {
    ...buildGameAccountFields(),
    translations: {
      en: buildGameAccountFields()
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminAccount', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminAccount', default: null }
  },
  { timestamps: true }
)

module.exports = mongoose.model('GameAccountContent', gameAccountContentSchema, 'game_account_contents')
