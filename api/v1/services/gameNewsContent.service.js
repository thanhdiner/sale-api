const cache = require('../../../config/redis')
const gameNewsContentRepository = require('../repositories/gameNewsContent.repository')

const GAME_NEWS_CONTENT_CACHE_PATTERN = 'game-news:content:*'
const TTL_GAME_NEWS_CONTENT = 600

const isObjectString = value => typeof value === 'string' && value.trim() === '[object Object]'
const cleanString = value => (typeof value === 'string' && !isObjectString(value) ? value.trim() : '')
const cleanText = value => (typeof value === 'string' && !isObjectString(value) ? value : '')

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function normalizeLanguage(language) {
  return String(language || '').toLowerCase().startsWith('en') ? 'en' : 'vi'
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

async function getAdminGameNewsContent() {
  return {
    message: 'Game news content fetched successfully',
    data: await gameNewsContentRepository.findOne({ lean: true })
  }
}

async function getClientGameNewsContent(language = 'vi') {
  const normalizedLanguage = normalizeLanguage(language)

  return cache.getOrSet(
    `game-news:content:${normalizedLanguage}`,
    async () => {
      const content = await gameNewsContentRepository.findOne({ lean: true })

      return {
        message: 'Game news content fetched successfully',
        data: localizeContent(content, normalizedLanguage)
      }
    },
    TTL_GAME_NEWS_CONTENT
  )
}

async function updateGameNewsContent(payload = {}, user = null) {
  const existingContent = await gameNewsContentRepository.findOne()
  const data = {
    ...normalizeContent(payload),
    translations: normalizeTranslations(payload.translations),
    updatedBy: user?.userId || user?.id || null
  }

  let savedContent

  if (existingContent) {
    savedContent = await gameNewsContentRepository.updateById(existingContent._id, data)
  } else {
    savedContent = await gameNewsContentRepository.create({
      ...data,
      createdBy: user?.userId || user?.id || null
    })
  }

  await cache.del(GAME_NEWS_CONTENT_CACHE_PATTERN)

  return {
    message: 'Game news content saved successfully',
    data: savedContent
  }
}

module.exports = {
  getAdminGameNewsContent,
  getClientGameNewsContent,
  updateGameNewsContent
}
