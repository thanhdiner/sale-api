const termsContentRepository = require('../../repositories/termsContent.repository')

const cleanString = value => (typeof value === 'string' ? value.trim() : '')
const cleanText = value => (typeof value === 'string' ? value : '')

const normalizeStringArray = value => {
  if (!Array.isArray(value)) return []
  return value.map(cleanString).filter(Boolean)
}

function normalizeSections(sections = []) {
  if (!Array.isArray(sections)) return []

  return sections
    .map((section, index) => ({
      id: cleanString(section?.id) || `section-${index + 1}`,
      title: cleanString(section?.title),
      paragraphs: normalizeStringArray(section?.paragraphs),
      items: normalizeStringArray(section?.items),
      footer: cleanText(section?.footer)
    }))
    .filter(section => section.id || section.title || section.paragraphs.length || section.items.length || section.footer)
}

function normalizeTermsContent(payload = {}) {
  return {
    seo: {
      title: cleanString(payload.seo?.title),
      description: cleanText(payload.seo?.description)
    },
    header: {
      eyebrow: cleanString(payload.header?.eyebrow),
      title: cleanString(payload.header?.title),
      updatedAt: cleanString(payload.header?.updatedAt)
    },
    notice: {
      title: cleanString(payload.notice?.title),
      description: cleanText(payload.notice?.description)
    },
    sections: normalizeSections(payload.sections)
  }
}

function normalizeTranslations(translations = {}) {
  return {
    en: normalizeTermsContent(translations.en || {})
  }
}

async function getTermsContent() {
  return {
    message: 'Terms content fetched successfully',
    data: await termsContentRepository.findOne({ lean: true })
  }
}

async function updateTermsContent(payload = {}, user = null) {
  const existingContent = await termsContentRepository.findOne()
  const data = {
    ...normalizeTermsContent(payload),
    translations: normalizeTranslations(payload.translations),
    updatedBy: user?.userId || null
  }

  let savedContent

  if (existingContent) {
    savedContent = await termsContentRepository.updateById(existingContent._id, data)
  } else {
    savedContent = await termsContentRepository.create({
      ...data,
      createdBy: user?.userId || null
    })
  }

  return {
    message: 'Terms content saved successfully',
    data: savedContent
  }
}

module.exports = {
  getTermsContent,
  updateTermsContent
}
