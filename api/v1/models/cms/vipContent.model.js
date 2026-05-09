const mongoose = require('mongoose')

const buildSeoSchema = () => new mongoose.Schema(
  {
    title: { type: String, trim: true, default: '' },
    description: { type: String, default: '' }
  },
  { _id: false }
)

const buildHeroSchema = () => new mongoose.Schema(
  {
    eyebrow: { type: String, trim: true, default: '' },
    title: { type: String, trim: true, default: '' },
    description: { type: String, default: '' },
    status: { type: String, trim: true, default: '' },
    primaryButton: { type: String, trim: true, default: '' },
    primaryButtonLink: { type: String, trim: true, default: '' },
    secondaryButton: { type: String, trim: true, default: '' },
    secondaryButtonLink: { type: String, trim: true, default: '' },
    imageUrl: { type: String, trim: true, default: '' },
    imageAlt: { type: String, trim: true, default: '' }
  },
  { _id: false }
)

const buildStatSchema = () => new mongoose.Schema(
  {
    value: { type: String, trim: true, default: '' },
    label: { type: String, trim: true, default: '' }
  },
  { _id: false }
)

const buildBenefitSchema = () => new mongoose.Schema(
  {
    title: { type: String, trim: true, default: '' },
    description: { type: String, default: '' }
  },
  { _id: false }
)

const buildComparisonRowSchema = () => new mongoose.Schema(
  {
    benefit: { type: String, trim: true, default: '' },
    silver: { type: String, trim: true, default: '' },
    gold: { type: String, trim: true, default: '' },
    diamond: { type: String, trim: true, default: '' }
  },
  { _id: false }
)

const buildPlanSchema = () => new mongoose.Schema(
  {
    name: { type: String, trim: true, default: '' },
    badge: { type: String, trim: true, default: '' },
    price: { type: String, trim: true, default: '' },
    period: { type: String, trim: true, default: '' },
    description: { type: String, default: '' },
    features: { type: [String], default: [] },
    ctaLabel: { type: String, trim: true, default: '' },
    ctaLink: { type: String, trim: true, default: '' },
    highlighted: { type: Boolean, default: false }
  },
  { _id: false }
)

const buildSectionSchema = () => new mongoose.Schema(
  {
    eyebrow: { type: String, trim: true, default: '' },
    title: { type: String, trim: true, default: '' },
    description: { type: String, default: '' }
  },
  { _id: false }
)

const buildFaqSchema = () => new mongoose.Schema(
  {
    question: { type: String, trim: true, default: '' },
    answer: { type: String, default: '' }
  },
  { _id: false }
)

const buildCtaSchema = () => new mongoose.Schema(
  {
    title: { type: String, trim: true, default: '' },
    description: { type: String, default: '' },
    button: { type: String, trim: true, default: '' },
    buttonLink: { type: String, trim: true, default: '' }
  },
  { _id: false }
)

const buildVipContentFields = () => ({
  seo: { type: buildSeoSchema(), default: () => ({}) },
  hero: { type: buildHeroSchema(), default: () => ({}) },
  stats: { type: [buildStatSchema()], default: [] },
  quickBenefits: { type: [buildBenefitSchema()], default: [] },
  benefitsSection: { type: buildSectionSchema(), default: () => ({}) },
  benefits: { type: [buildBenefitSchema()], default: [] },
  plansSection: { type: buildSectionSchema(), default: () => ({}) },
  plans: { type: [buildPlanSchema()], default: [] },
  comparisonSection: { type: buildSectionSchema(), default: () => ({}) },
  comparisonRows: { type: [buildComparisonRowSchema()], default: [] },
  faqSection: { type: buildSectionSchema(), default: () => ({}) },
  faqs: { type: [buildFaqSchema()], default: [] },
  cta: { type: buildCtaSchema(), default: () => ({}) }
})

const vipContentSchema = new mongoose.Schema(
  {
    ...buildVipContentFields(),
    translations: {
      en: buildVipContentFields()
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminAccount', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminAccount', default: null }
  },
  { timestamps: true }
)

module.exports = mongoose.model('VipContent', vipContentSchema, 'vip_contents')









