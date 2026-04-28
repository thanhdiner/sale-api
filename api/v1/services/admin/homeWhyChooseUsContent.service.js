const homeWhyChooseUsContentRepository = require('../../repositories/homeWhyChooseUsContent.repository')

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

async function getHomeWhyChooseUsContent() {
  return {
    message: 'Home why choose us content fetched successfully',
    data: await homeWhyChooseUsContentRepository.findOne({ lean: true })
  }
}

async function updateHomeWhyChooseUsContent(payload = {}, user = null) {
  const existingContent = await homeWhyChooseUsContentRepository.findOne()
  const data = {
    ...normalizeContent(payload),
    translations: normalizeTranslations(payload.translations),
    updatedBy: user?.userId || null
  }

  let savedContent

  if (existingContent) {
    savedContent = await homeWhyChooseUsContentRepository.updateById(existingContent._id, data)
  } else {
    savedContent = await homeWhyChooseUsContentRepository.create({
      ...data,
      createdBy: user?.userId || null
    })
  }

  return {
    message: 'Home why choose us content saved successfully',
    data: savedContent
  }
}

module.exports = {
  getHomeWhyChooseUsContent,
  updateHomeWhyChooseUsContent
}
