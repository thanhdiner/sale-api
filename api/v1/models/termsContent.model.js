const mongoose = require('mongoose')

const buildSeoSchema = () => new mongoose.Schema(
  {
    title: { type: String, trim: true, default: '' },
    description: { type: String, default: '' }
  },
  { _id: false }
)

const buildHeaderSchema = () => new mongoose.Schema(
  {
    eyebrow: { type: String, trim: true, default: '' },
    title: { type: String, trim: true, default: '' },
    updatedAt: { type: String, trim: true, default: '' }
  },
  { _id: false }
)

const buildNoticeSchema = () => new mongoose.Schema(
  {
    title: { type: String, trim: true, default: '' },
    description: { type: String, default: '' }
  },
  { _id: false }
)

const buildTermsSectionSchema = () => new mongoose.Schema(
  {
    id: { type: String, trim: true, default: '' },
    title: { type: String, trim: true, default: '' },
    paragraphs: { type: [String], default: [] },
    items: { type: [String], default: [] },
    footer: { type: String, default: '' }
  },
  { _id: false }
)

const buildTermsContentFields = () => ({
  seo: { type: buildSeoSchema(), default: () => ({}) },
  header: { type: buildHeaderSchema(), default: () => ({}) },
  notice: { type: buildNoticeSchema(), default: () => ({}) },
  sections: { type: [buildTermsSectionSchema()], default: [] }
})

const termsContentSchema = new mongoose.Schema(
  {
    ...buildTermsContentFields(),
    translations: {
      en: buildTermsContentFields()
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminAccount', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminAccount', default: null }
  },
  { timestamps: true }
)

module.exports = mongoose.model('TermsContent', termsContentSchema, 'terms_contents')
