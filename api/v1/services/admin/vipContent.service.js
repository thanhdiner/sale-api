const cache = require('../../../../config/redis')
const vipContentRepository = require('../../repositories/vipContent.repository')

const cleanString = value => (typeof value === 'string' ? value.trim() : '')
const cleanText = value => (typeof value === 'string' ? value : '')

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return []
  return value.map(cleanString).filter(Boolean)
}

function normalizeSection(section = {}) {
  return {
    eyebrow: cleanString(section.eyebrow),
    title: cleanString(section.title),
    description: cleanText(section.description)
  }
}

function normalizeStats(stats = []) {
  if (!Array.isArray(stats)) return []

  return stats
    .map(item => ({
      value: cleanString(item?.value),
      label: cleanString(item?.label)
    }))
    .filter(item => item.value || item.label)
}

function normalizeBenefits(benefits = []) {
  if (!Array.isArray(benefits)) return []

  return benefits
    .map(item => ({
      title: cleanString(item?.title),
      description: cleanText(item?.description)
    }))
    .filter(item => item.title || item.description)
}

function normalizeComparisonRows(rows = []) {
  if (!Array.isArray(rows)) return []

  return rows
    .map(item => ({
      benefit: cleanString(item?.benefit),
      silver: cleanString(item?.silver),
      gold: cleanString(item?.gold),
      diamond: cleanString(item?.diamond)
    }))
    .filter(item => item.benefit || item.silver || item.gold || item.diamond)
}

function normalizePlans(plans = []) {
  if (!Array.isArray(plans)) return []

  return plans
    .map(item => ({
      name: cleanString(item?.name),
      badge: cleanString(item?.badge),
      price: cleanString(item?.price),
      period: cleanString(item?.period),
      description: cleanText(item?.description),
      features: normalizeStringArray(item?.features),
      ctaLabel: cleanString(item?.ctaLabel),
      ctaLink: cleanString(item?.ctaLink),
      highlighted: item?.highlighted === true || item?.highlighted === 'true'
    }))
    .filter(item =>
      item.name ||
      item.badge ||
      item.price ||
      item.period ||
      item.description ||
      item.features.length ||
      item.ctaLabel ||
      item.ctaLink
    )
}

function normalizeFaqs(faqs = []) {
  if (!Array.isArray(faqs)) return []

  return faqs
    .map(item => ({
      question: cleanString(item?.question),
      answer: cleanText(item?.answer)
    }))
    .filter(item => item.question || item.answer)
}

function normalizeVipContent(payload = {}) {
  return {
    seo: {
      title: cleanString(payload.seo?.title),
      description: cleanText(payload.seo?.description)
    },
    hero: {
      eyebrow: cleanString(payload.hero?.eyebrow),
      title: cleanString(payload.hero?.title),
      description: cleanText(payload.hero?.description),
      status: cleanString(payload.hero?.status),
      primaryButton: cleanString(payload.hero?.primaryButton),
      primaryButtonLink: cleanString(payload.hero?.primaryButtonLink),
      secondaryButton: cleanString(payload.hero?.secondaryButton),
      secondaryButtonLink: cleanString(payload.hero?.secondaryButtonLink),
      imageUrl: cleanString(payload.hero?.imageUrl),
      imageAlt: cleanString(payload.hero?.imageAlt)
    },
    stats: normalizeStats(payload.stats),
    quickBenefits: normalizeBenefits(payload.quickBenefits),
    benefitsSection: normalizeSection(payload.benefitsSection),
    benefits: normalizeBenefits(payload.benefits),
    plansSection: normalizeSection(payload.plansSection),
    plans: normalizePlans(payload.plans),
    comparisonSection: normalizeSection(payload.comparisonSection),
    comparisonRows: normalizeComparisonRows(payload.comparisonRows),
    faqSection: normalizeSection(payload.faqSection),
    faqs: normalizeFaqs(payload.faqs),
    cta: {
      title: cleanString(payload.cta?.title),
      description: cleanText(payload.cta?.description),
      button: cleanString(payload.cta?.button),
      buttonLink: cleanString(payload.cta?.buttonLink)
    }
  }
}

function normalizeTranslations(translations = {}) {
  return {
    en: normalizeVipContent(translations.en || {})
  }
}

async function getVipContent() {
  return {
    message: 'VIP content fetched successfully',
    data: await vipContentRepository.findOne({ lean: true })
  }
}

async function updateVipContent(payload = {}, user = null) {
  const existingContent = await vipContentRepository.findOne()
  const data = {
    ...normalizeVipContent(payload),
    translations: normalizeTranslations(payload.translations),
    updatedBy: user?.userId || user?.id || null
  }

  let savedContent

  if (existingContent) {
    savedContent = await vipContentRepository.updateById(existingContent._id, data)
  } else {
    savedContent = await vipContentRepository.create({
      ...data,
      createdBy: user?.userId || user?.id || null
    })
  }

  await cache.del('vip:content:*')

  return {
    message: 'VIP content saved successfully',
    data: savedContent
  }
}

module.exports = {
  getVipContent,
  updateVipContent
}
