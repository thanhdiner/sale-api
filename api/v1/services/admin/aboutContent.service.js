const aboutContentRepository = require('../../repositories/aboutContent.repository')

const cleanString = value => (typeof value === 'string' ? value.trim() : '')
const cleanText = value => (typeof value === 'string' ? value : '')

const normalizeStringArray = value => {
  if (!Array.isArray(value)) return []
  return value.map(cleanString).filter(Boolean)
}

const normalizeTextItems = value => {
  if (!Array.isArray(value)) return []

  return value
    .map(item => ({
      title: cleanString(item?.title),
      description: cleanText(item?.description)
    }))
    .filter(item => item.title || item.description)
}

function normalizeAboutContent(payload = {}) {
  return {
    seo: {
      title: cleanString(payload.seo?.title),
      description: cleanText(payload.seo?.description)
    },
    heroSection: {
      eyebrow: cleanString(payload.heroSection?.eyebrow),
      titleLines: normalizeStringArray(payload.heroSection?.titleLines),
      description: cleanText(payload.heroSection?.description),
      primaryButton: cleanString(payload.heroSection?.primaryButton),
      primaryButtonLink: cleanString(payload.heroSection?.primaryButtonLink),
      secondaryButton: cleanString(payload.heroSection?.secondaryButton),
      secondaryButtonLink: cleanString(payload.heroSection?.secondaryButtonLink),
      reviews: cleanString(payload.heroSection?.reviews),
      imageAlt: cleanString(payload.heroSection?.imageAlt),
      imageUrl: cleanString(payload.heroSection?.imageUrl)
    },
    benefitsSection: {
      title: cleanString(payload.benefitsSection?.title),
      items: normalizeTextItems(payload.benefitsSection?.items)
    },
    featuresSection: {
      eyebrow: cleanString(payload.featuresSection?.eyebrow),
      titleLines: normalizeStringArray(payload.featuresSection?.titleLines),
      description: cleanText(payload.featuresSection?.description),
      button: cleanString(payload.featuresSection?.button),
      buttonLink: cleanString(payload.featuresSection?.buttonLink),
      steps: normalizeTextItems(payload.featuresSection?.steps)
    },
    ownerSection: {
      title: cleanString(payload.ownerSection?.title),
      paragraphs: normalizeStringArray(payload.ownerSection?.paragraphs),
      stats: {
        goodPrice: cleanString(payload.ownerSection?.stats?.goodPrice),
        support: cleanString(payload.ownerSection?.stats?.support),
        easyBuy: cleanString(payload.ownerSection?.stats?.easyBuy),
        consulting: cleanString(payload.ownerSection?.stats?.consulting)
      },
      imageAlt: cleanString(payload.ownerSection?.imageAlt),
      imageUrl: cleanString(payload.ownerSection?.imageUrl),
      ribbon: {
        brand: cleanString(payload.ownerSection?.ribbon?.brand),
        text: cleanString(payload.ownerSection?.ribbon?.text)
      }
    },
    timelineSection: {
      items: normalizeTextItems(payload.timelineSection?.items)
    },
    ctaSection: {
      title: cleanString(payload.ctaSection?.title),
      description: cleanText(payload.ctaSection?.description),
      button: cleanString(payload.ctaSection?.button),
      buttonLink: cleanString(payload.ctaSection?.buttonLink)
    }
  }
}

function normalizeTranslations(translations = {}) {
  return {
    en: normalizeAboutContent(translations.en || {})
  }
}

async function getAboutContent() {
  return {
    message: 'About content fetched successfully',
    data: await aboutContentRepository.findOne({ lean: true })
  }
}

async function updateAboutContent(payload = {}, user = null) {
  const existingContent = await aboutContentRepository.findOne()
  const data = {
    ...normalizeAboutContent(payload),
    translations: normalizeTranslations(payload.translations),
    updatedBy: user?.userId || null
  }

  let savedContent

  if (existingContent) {
    savedContent = await aboutContentRepository.updateById(existingContent._id, data)
  } else {
    savedContent = await aboutContentRepository.create({
      ...data,
      createdBy: user?.userId || null
    })
  }

  return {
    message: 'About content saved successfully',
    data: savedContent
  }
}

module.exports = {
  getAboutContent,
  updateAboutContent
}
