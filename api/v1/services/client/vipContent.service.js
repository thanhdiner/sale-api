const cache = require('../../../../config/redis')
const vipContentRepository = require('../../repositories/vipContent.repository')

const TTL_VIP_CONTENT = 600

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

function localizeVipContent(content, language) {
  if (!content) return null

  const baseContent = removeSystemFields(content)

  if (normalizeLanguage(language) !== 'en') {
    return baseContent
  }

  return mergeLocalized(baseContent, content.translations?.en || {})
}

async function getVipContent(language = 'vi') {
  const normalizedLanguage = normalizeLanguage(language)

  return cache.getOrSet(
    `vip:content:${normalizedLanguage}`,
    async () => {
      const content = await vipContentRepository.findOne({ lean: true })

      return {
        message: 'VIP content fetched successfully',
        data: localizeVipContent(content, normalizedLanguage)
      }
    },
    TTL_VIP_CONTENT
  )
}

module.exports = {
  getVipContent
}
