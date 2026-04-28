const cache = require('../../../config/redis')
const comingSoonContentRepository = require('../repositories/comingSoonContent.repository')
const AppError = require('../utils/AppError')

const COMING_SOON_CONTENT_CACHE_PATTERN = 'coming-soon:content:*'
const TTL_COMING_SOON_CONTENT = 600

const PAGE_KEYS = {
  community: 'community',
  quickSupport: 'quickSupport',
  'quick-support': 'quickSupport',
  license: 'license'
}

const isObjectString = value => typeof value === 'string' && value.trim() === '[object Object]'
const cleanString = value => (typeof value === 'string' && !isObjectString(value) ? value.trim() : '')
const cleanText = value => (typeof value === 'string' && !isObjectString(value) ? value : '')

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function normalizeLanguage(language) {
  return String(language || '').toLowerCase().startsWith('en') ? 'en' : 'vi'
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

function hasValue(value) {
  if (isPlainObject(value)) return Object.keys(value).length > 0
  return typeof value === 'string' ? value.trim().length > 0 : value !== undefined && value !== null
}

function mergeLocalized(base, translated) {
  if (isPlainObject(base) || isPlainObject(translated)) {
    const baseObject = isPlainObject(base) ? base : {}
    const translatedObject = isPlainObject(translated) ? translated : {}
    const keys = new Set([...Object.keys(baseObject), ...Object.keys(translatedObject)])

    return Array.from(keys).reduce((result, key) => {
      result[key] = mergeLocalized(baseObject[key], translatedObject[key])
      return result
    }, {})
  }

  return hasValue(translated) ? translated : base
}

function removeSystemFields(content = {}) {
  const {
    _id,
    __v,
    key,
    createdAt,
    updatedAt,
    createdBy,
    updatedBy,
    translations,
    ...publicContent
  } = content

  return publicContent
}

function localizeContent(content, language) {
  if (!content) return null

  const baseContent = removeSystemFields(content)

  if (normalizeLanguage(language) !== 'en') {
    return baseContent
  }

  return mergeLocalized(baseContent, content.translations?.en || {})
}

async function getAdminComingSoonContent(pageKey) {
  const normalizedPageKey = normalizePageKey(pageKey)

  return {
    message: 'Coming soon content fetched successfully',
    data: await comingSoonContentRepository.findByKey(normalizedPageKey, { lean: true })
  }
}

async function getClientComingSoonContent(pageKey, language = 'vi') {
  const normalizedPageKey = normalizePageKey(pageKey)
  const normalizedLanguage = normalizeLanguage(language)

  return cache.getOrSet(
    `coming-soon:content:${normalizedPageKey}:${normalizedLanguage}`,
    async () => {
      const content = await comingSoonContentRepository.findByKey(normalizedPageKey, { lean: true })

      return {
        message: 'Coming soon content fetched successfully',
        data: localizeContent(content, normalizedLanguage)
      }
    },
    TTL_COMING_SOON_CONTENT
  )
}

async function updateComingSoonContent(pageKey, payload = {}, user = null) {
  const normalizedPageKey = normalizePageKey(pageKey)
  const existingContent = await comingSoonContentRepository.findByKey(normalizedPageKey)
  const data = {
    key: normalizedPageKey,
    ...normalizeContent(payload),
    translations: normalizeTranslations(payload.translations),
    updatedBy: user?.userId || user?.id || null
  }

  let savedContent

  if (existingContent) {
    savedContent = await comingSoonContentRepository.updateById(existingContent._id, data)
  } else {
    savedContent = await comingSoonContentRepository.create({
      ...data,
      createdBy: user?.userId || user?.id || null
    })
  }

  await cache.del(COMING_SOON_CONTENT_CACHE_PATTERN)

  return {
    message: 'Coming soon content saved successfully',
    data: savedContent
  }
}

module.exports = {
  getAdminComingSoonContent,
  getClientComingSoonContent,
  updateComingSoonContent
}
