const mongoose = require('mongoose')

const buildSeoSchema = () => new mongoose.Schema(
  {
    title: { type: String, trim: true, default: '' },
    description: { type: String, default: '' }
  },
  { _id: false }
)

const buildGameNewsFields = () => ({
  seo: { type: buildSeoSchema(), default: () => ({}) },
  title: { type: String, trim: true, default: '' },
  description: { type: String, default: '' },
  descriptionSecondLine: { type: String, default: '' },
  status: { type: String, default: '' }
})

const gameNewsContentSchema = new mongoose.Schema(
  {
    ...buildGameNewsFields(),
    translations: {
      en: buildGameNewsFields()
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminAccount', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminAccount', default: null }
  },
  { timestamps: true }
)

module.exports = mongoose.model('GameNewsContent', gameNewsContentSchema, 'game_news_contents')
