const homeWhyChooseUsContentRepository = require('../../repositories/homeWhyChooseUsContent.repository')
const { createSingletonContentModule } = require('../../factories/singletonContent.factory')

const ITEM_KEYS = [
  'fastActivation',
  'fastDelivery',
  'flexiblePayment',
  'clearWarranty',
  'regularOffers',
  'dedicatedSupport'
]

const isObjectString = value => typeof value === 'string' && value.trim() === '[object Object]'
const cleanString = value => (typeof value === 'string' && !isObjectString(value) ? value.trim() : '')
const cleanText = value => (typeof value === 'string' && !isObjectString(value) ? value : '')

const normalizeStringArray = value => {
  if (!Array.isArray(value)) return []
  return value.map(cleanString).filter(Boolean)
}

function normalizeItems(items = {}) {
  return ITEM_KEYS.reduce((result, key) => {
    result[key] = {
      title: cleanString(items?.[key]?.title),
      desc: cleanText(items?.[key]?.desc)
    }

    return result
  }, {})
}

function normalizeContent(payload = {}) {
  return {
    eyebrow: cleanString(payload.eyebrow),
    title: cleanString(payload.title),
    descPhrases: normalizeStringArray(payload.descPhrases),
    cta: cleanString(payload.cta),
    items: normalizeItems(payload.items)
  }
}

function normalizeTranslations(translations = {}) {
  return {
    en: normalizeContent(translations.en || {})
  }
}

const { service } = createSingletonContentModule({
  repository: homeWhyChooseUsContentRepository,
  normalizeContent,
  normalizeTranslations,
  messages: {
    fetched: 'Home why choose us content fetched successfully',
    saved: 'Home why choose us content saved successfully'
  }
})

module.exports = {
  getHomeWhyChooseUsContent: service.getAdminContent,
  updateHomeWhyChooseUsContent: service.updateContent
}
