const cache = require('../../../../config/redis')
const aboutContentRepository = require('../../repositories/aboutContent.repository')

const TTL_ABOUT_CONTENT = 600

function normalizeLanguage(language) {
  return String(language || '').toLowerCase().startsWith('en') ? 'en' : 'vi'
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function hasValue(value) {
  if (Array.isArray(value)) return value.length > 0
  if (isPlainObject(value)) return Object.keys(value).length > 0
  return typeof value === 'string' ? value.trim().length > 0 : value !== undefined && value !== null
}

function mergeLocalized(base, translated) {
  if (Array.isArray(base) || Array.isArray(translated)) {
    const baseItems = Array.isArray(base) ? base : []
    const translatedItems = Array.isArray(translated) ? translated : []
    const length = Math.max(baseItems.length, translatedItems.length)

    return Array.from({ length }, (_, index) => mergeLocalized(baseItems[index], translatedItems[index]))
      .filter(item => hasValue(item))
  }

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

function localizeAboutContent(content, language) {
  if (!content) return null

  const baseContent = removeSystemFields(content)

  if (normalizeLanguage(language) !== 'en') {
    return baseContent
  }

  return mergeLocalized(baseContent, content.translations?.en || {})
}

async function getAboutContent(language = 'vi') {
  const normalizedLanguage = normalizeLanguage(language)

  return cache.getOrSet(
    `about:content:${normalizedLanguage}`,
    async () => {
      const content = await aboutContentRepository.findOne({ lean: true })

      return {
        message: 'About content fetched successfully',
        data: localizeAboutContent(content, normalizedLanguage)
      }
    },
    TTL_ABOUT_CONTENT
  )
}

module.exports = {
  getAboutContent
}
