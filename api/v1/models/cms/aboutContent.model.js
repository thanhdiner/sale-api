const mongoose = require('mongoose')

const buildTextItemSchema = () => new mongoose.Schema(
  {
    title: { type: String, trim: true, default: '' },
    description: { type: String, default: '' }
  },
  { _id: false }
)

const buildSeoSchema = () => new mongoose.Schema(
  {
    title: { type: String, trim: true, default: '' },
    description: { type: String, default: '' }
  },
  { _id: false }
)

const buildRibbonSchema = () => new mongoose.Schema(
  {
    brand: { type: String, trim: true, default: '' },
    text: { type: String, trim: true, default: '' }
  },
  { _id: false }
)

const buildOwnerStatsSchema = () => new mongoose.Schema(
  {
    goodPrice: { type: String, trim: true, default: '' },
    support: { type: String, trim: true, default: '' },
    easyBuy: { type: String, trim: true, default: '' },
    consulting: { type: String, trim: true, default: '' }
  },
  { _id: false }
)

const buildHeroSectionSchema = () => new mongoose.Schema(
  {
    eyebrow: { type: String, trim: true, default: '' },
    titleLines: { type: [String], default: [] },
    description: { type: String, default: '' },
    primaryButton: { type: String, trim: true, default: '' },
    primaryButtonLink: { type: String, trim: true, default: '' },
    secondaryButton: { type: String, trim: true, default: '' },
    secondaryButtonLink: { type: String, trim: true, default: '' },
    reviews: { type: String, trim: true, default: '' },
    imageAlt: { type: String, trim: true, default: '' },
    imageUrl: { type: String, trim: true, default: '' }
  },
  { _id: false }
)

const buildBenefitsSectionSchema = () => new mongoose.Schema(
  {
    title: { type: String, trim: true, default: '' },
    items: { type: [buildTextItemSchema()], default: [] }
  },
  { _id: false }
)

const buildFeaturesSectionSchema = () => new mongoose.Schema(
  {
    eyebrow: { type: String, trim: true, default: '' },
    titleLines: { type: [String], default: [] },
    description: { type: String, default: '' },
    button: { type: String, trim: true, default: '' },
    buttonLink: { type: String, trim: true, default: '' },
    steps: { type: [buildTextItemSchema()], default: [] }
  },
  { _id: false }
)

const buildOwnerSectionSchema = () => new mongoose.Schema(
  {
    title: { type: String, trim: true, default: '' },
    paragraphs: { type: [String], default: [] },
    stats: { type: buildOwnerStatsSchema(), default: () => ({}) },
    imageAlt: { type: String, trim: true, default: '' },
    imageUrl: { type: String, trim: true, default: '' },
    ribbon: { type: buildRibbonSchema(), default: () => ({}) }
  },
  { _id: false }
)

const buildTimelineSectionSchema = () => new mongoose.Schema(
  {
    items: { type: [buildTextItemSchema()], default: [] }
  },
  { _id: false }
)

const buildCtaSectionSchema = () => new mongoose.Schema(
  {
    title: { type: String, trim: true, default: '' },
    description: { type: String, default: '' },
    button: { type: String, trim: true, default: '' },
    buttonLink: { type: String, trim: true, default: '' }
  },
  { _id: false }
)

const buildAboutContentFields = () => ({
  seo: { type: buildSeoSchema(), default: () => ({}) },
  heroSection: { type: buildHeroSectionSchema(), default: () => ({}) },
  benefitsSection: { type: buildBenefitsSectionSchema(), default: () => ({}) },
  featuresSection: { type: buildFeaturesSectionSchema(), default: () => ({}) },
  ownerSection: { type: buildOwnerSectionSchema(), default: () => ({}) },
  timelineSection: { type: buildTimelineSectionSchema(), default: () => ({}) },
  ctaSection: { type: buildCtaSectionSchema(), default: () => ({}) }
})

const aboutContentSchema = new mongoose.Schema(
  {
    ...buildAboutContentFields(),
    translations: {
      en: buildAboutContentFields()
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminAccount', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminAccount', default: null }
  },
  { timestamps: true }
)

module.exports = mongoose.model('AboutContent', aboutContentSchema, 'about_contents')









