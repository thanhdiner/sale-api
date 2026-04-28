const cache = require('../../../../config/redis')
const cooperationContactContentRepository = require('../../repositories/cooperationContactContent.repository')

const TTL_COOPERATION_CONTACT_CONTENT = 600

function normalizeLanguage(language) {
  return String(language || '').toLowerCase().startsWith('en') ? 'en' : 'vi'
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
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

async function getCooperationContactContent(language = 'vi') {
  const normalizedLanguage = normalizeLanguage(language)

  return cache.getOrSet(
    `cooperation-contact:content:${normalizedLanguage}`,
    async () => {
      const content = await cooperationContactContentRepository.findOne({ lean: true })

      return {
        message: 'Cooperation contact content fetched successfully',
        data: localizeContent(content, normalizedLanguage)
      }
    },
    TTL_COOPERATION_CONTACT_CONTENT
  )
}

module.exports = {
  getCooperationContactContent
}
