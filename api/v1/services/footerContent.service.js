const cache = require('../../../config/redis')
const footerContentRepository = require('../repositories/footerContent.repository')
const AppError = require('../utils/AppError')

const FOOTER_CONTENT_KEY = 'footer-content'
const FOOTER_CONTENT_CACHE_PATTERN = 'footer-content:*'

const isPlainObject = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const clone = value => JSON.parse(JSON.stringify(value || {}))

function deepClean(value) {
  if (Array.isArray(value)) {
    return value.map(item => deepClean(item))
  }

  if (isPlainObject(value)) {
    return Object.keys(value).reduce((cleaned, key) => {
      cleaned[key] = deepClean(value[key])
      return cleaned
    }, {})
  }

  return typeof value === 'string' ? value.trim() : value
}

function hasLocalizedValue(value) {
  if (Array.isArray(value)) return value.length > 0
  return typeof value === 'string' ? value.trim().length > 0 : value !== undefined && value !== null
}

function deepMergeLocalized(baseValue, localizedValue) {
  if (Array.isArray(baseValue)) {
    if (!Array.isArray(localizedValue)) return clone(baseValue)

    const length = Math.max(baseValue.length, localizedValue.length)
    return Array.from({ length }, (_item, index) => {
      const baseItem = baseValue[index]
      const localizedItem = localizedValue[index]

      if (isPlainObject(baseItem) || isPlainObject(localizedItem)) {
        return deepMergeLocalized(baseItem || {}, localizedItem || {})
      }

      return hasLocalizedValue(localizedItem) ? localizedItem : baseItem
    }).filter(item => item !== undefined)
  }

  if (isPlainObject(baseValue)) {
    const localizedObject = isPlainObject(localizedValue) ? localizedValue : {}
    const keys = new Set([...Object.keys(baseValue), ...Object.keys(localizedObject)])
    const merged = {}

    keys.forEach(key => {
      merged[key] = deepMergeLocalized(baseValue[key], localizedObject[key])
    })

    return merged
  }

  return hasLocalizedValue(localizedValue) ? localizedValue : baseValue
}

function normalizeLanguage(language) {
  return String(language || '').toLowerCase().startsWith('en') ? 'en' : 'vi'
}

function toPlainObject(document) {
  if (!document) return document
  return typeof document.toObject === 'function' ? document.toObject() : document
}

function normalizeTranslations(translations = {}) {
  return {
    en: isPlainObject(translations?.en) ? deepClean(translations.en) : {}
  }
}

async function getOrCreateFooterContent() {
  const existing = await footerContentRepository.findOne({ key: FOOTER_CONTENT_KEY })
  if (existing) return existing

  try {
    return await footerContentRepository.create({
      key: FOOTER_CONTENT_KEY,
      content: {},
      translations: { en: {} }
    })
  } catch (error) {
    if (error?.code === 11000) {
      return footerContentRepository.findOne({ key: FOOTER_CONTENT_KEY })
    }

    throw error
  }
}

async function getAdminFooterContent() {
  const footerContent = await getOrCreateFooterContent()
  const plainFooterContent = toPlainObject(footerContent)

  return {
    message: 'Footer content fetched successfully',
    data: {
      ...plainFooterContent,
      content: isPlainObject(plainFooterContent.content) ? plainFooterContent.content : {},
      translations: normalizeTranslations(plainFooterContent.translations)
    }
  }
}

async function getClientFooterContent(language = 'vi') {
  const normalizedLanguage = normalizeLanguage(language)

  return cache.getOrSet(
    `footer-content:${normalizedLanguage}`,
    async () => {
      const footerContent = await getOrCreateFooterContent()
      const plainFooterContent = toPlainObject(footerContent)
      const content = isPlainObject(plainFooterContent.content) ? plainFooterContent.content : {}
      const translations = normalizeTranslations(plainFooterContent.translations)

      return {
        message: 'Footer content fetched successfully',
        data: normalizedLanguage === 'en' ? deepMergeLocalized(content, translations.en) : content
      }
    },
    300
  )
}

async function updateFooterContent(payload = {}, user = null) {
  if (!isPlainObject(payload.content)) {
    throw new AppError('Footer content is required', 400)
  }

  const footerContent = await getOrCreateFooterContent()
  footerContent.content = deepClean(payload.content)
  footerContent.translations = normalizeTranslations(payload.translations)
  footerContent.updatedBy = user?.userId || user?.id || null

  await footerContent.save()
  await cache.del(FOOTER_CONTENT_CACHE_PATTERN)

  return {
    message: 'Footer content updated successfully',
    data: {
      ...toPlainObject(footerContent),
      content: footerContent.content,
      translations: normalizeTranslations(footerContent.translations)
    }
  }
}

module.exports = {
  getAdminFooterContent,
  getClientFooterContent,
  updateFooterContent
}
