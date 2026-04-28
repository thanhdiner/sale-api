const comingSoonContentRepository = require('../repositories/comingSoonContent.repository')
const AppError = require('../utils/AppError')
const {
  cleanString,
  cleanText,
  createSingletonContentModule
} = require('../factories/singletonContent.factory')

const COMING_SOON_CONTENT_CACHE_PATTERN = 'coming-soon:content:*'
const TTL_COMING_SOON_CONTENT = 600

const PAGE_KEYS = {
  community: 'community',
  quickSupport: 'quickSupport',
  'quick-support': 'quickSupport',
  license: 'license'
}

function normalizePageKey(key) {
  const normalizedKey = PAGE_KEYS[String(key || '').trim()]

  if (!normalizedKey) {
    throw new AppError('Unsupported coming soon page', 404)
  }

  return normalizedKey
}

function normalizeContent(payload = {}) {
  return {
    seo: {
      title: cleanString(payload.seo?.title),
      description: cleanText(payload.seo?.description)
    },
    title: cleanString(payload.title),
    description: cleanText(payload.description),
    descriptionSecondLine: cleanText(payload.descriptionSecondLine),
    status: cleanString(payload.status)
  }
}

function normalizeTranslations(translations = {}) {
  return {
    en: normalizeContent(translations.en || {})
  }
}

const { service } = createSingletonContentModule({
  repository: comingSoonContentRepository,
  normalizeKey: normalizePageKey,
  normalizeContent,
  normalizeTranslations,
  messages: {
    fetched: 'Coming soon content fetched successfully',
    saved: 'Coming soon content saved successfully'
  },
  cacheKey: ({ key, language }) => `coming-soon:content:${key}:${language}`,
  cachePattern: COMING_SOON_CONTENT_CACHE_PATTERN,
  publicOmitFields: ['key'],
  ttl: TTL_COMING_SOON_CONTENT
})

module.exports = {
  getAdminComingSoonContent: service.getAdminContent,
  getClientComingSoonContent: service.getClientContent,
  updateComingSoonContent: service.updateContent
}
