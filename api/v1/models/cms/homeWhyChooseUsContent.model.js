const mongoose = require('mongoose')

const ITEM_KEYS = [
  'fastActivation',
  'fastDelivery',
  'flexiblePayment',
  'clearWarranty',
  'regularOffers',
  'dedicatedSupport'
]

const buildItemSchema = () => new mongoose.Schema(
  {
    title: { type: String, trim: true, default: '' },
    desc: { type: String, default: '' }
  },
  { _id: false }
)

const buildItemsSchema = () => {
  const itemSchema = buildItemSchema()

  return new mongoose.Schema(
    ITEM_KEYS.reduce((schema, key) => {
      schema[key] = { type: itemSchema, default: () => ({}) }
      return schema
    }, {}),
    { _id: false }
  )
}

const buildHomeWhyChooseUsFields = () => ({
  eyebrow: { type: String, trim: true, default: '' },
  title: { type: String, trim: true, default: '' },
  descPhrases: { type: [String], default: [] },
  cta: { type: String, trim: true, default: '' },
  items: { type: buildItemsSchema(), default: () => ({}) }
})

const homeWhyChooseUsContentSchema = new mongoose.Schema(
  {
    ...buildHomeWhyChooseUsFields(),
    translations: {
      en: buildHomeWhyChooseUsFields()
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminAccount', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminAccount', default: null }
  },
  { timestamps: true }
)

module.exports = mongoose.model('HomeWhyChooseUsContent', homeWhyChooseUsContentSchema, 'home_why_choose_us_contents')









