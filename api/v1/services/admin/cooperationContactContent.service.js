const cooperationContactContentRepository = require('../../repositories/cooperationContactContent.repository')
const { createSingletonContentModule } = require('../../factories/singletonContent.factory')

const isObjectString = value => typeof value === 'string' && value.trim() === '[object Object]'
const cleanString = value => (typeof value === 'string' && !isObjectString(value) ? value.trim() : '')
const cleanText = value => (typeof value === 'string' && !isObjectString(value) ? value : '')

function normalizeContent(payload = {}) {
  return {
    seo: {
      title: cleanString(payload.seo?.title),
      description: cleanText(payload.seo?.description)
    },
    eyebrow: cleanString(payload.eyebrow),
    title: cleanString(payload.title),
    description: cleanText(payload.description),
    emailLabel: cleanString(payload.emailLabel),
    phoneLabel: cleanString(payload.phoneLabel),
    email: cleanString(payload.email),
    phone: cleanString(payload.phone),
    note: cleanText(payload.note)
  }
}

function normalizeTranslations(translations = {}) {
  return {
    en: normalizeContent(translations.en || {})
  }
}

const { service } = createSingletonContentModule({
  repository: cooperationContactContentRepository,
  normalizeContent,
  normalizeTranslations,
  messages: {
    fetched: 'Cooperation contact content fetched successfully',
    saved: 'Cooperation contact content saved successfully'
  }
})

module.exports = {
  getCooperationContactContent: service.getAdminContent,
  updateCooperationContactContent: service.updateContent
}
