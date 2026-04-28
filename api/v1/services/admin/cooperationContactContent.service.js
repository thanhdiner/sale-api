const cooperationContactContentRepository = require('../../repositories/cooperationContactContent.repository')

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

async function getCooperationContactContent() {
  return {
    message: 'Cooperation contact content fetched successfully',
    data: await cooperationContactContentRepository.findOne({ lean: true })
  }
}

async function updateCooperationContactContent(payload = {}, user = null) {
  const existingContent = await cooperationContactContentRepository.findOne()
  const data = {
    ...normalizeContent(payload),
    translations: normalizeTranslations(payload.translations),
    updatedBy: user?.userId || null
  }

  let savedContent

  if (existingContent) {
    savedContent = await cooperationContactContentRepository.updateById(existingContent._id, data)
  } else {
    savedContent = await cooperationContactContentRepository.create({
      ...data,
      createdBy: user?.userId || null
    })
  }

  return {
    message: 'Cooperation contact content saved successfully',
    data: savedContent
  }
}

module.exports = {
  getCooperationContactContent,
  updateCooperationContactContent
}
