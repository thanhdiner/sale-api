const cache = require('../../../config/redis')
const faqPageRepository = require('../repositories/faqPage.repository')
const AppError = require('../utils/AppError')

const FAQ_PAGE_KEY = 'faq-page'
const FAQ_PAGE_CACHE_PATTERN = 'faq-page:*'

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

async function getOrCreateFaqPage() {
  const existing = await faqPageRepository.findOne({ key: FAQ_PAGE_KEY })
  if (existing) return existing

  try {
    return await faqPageRepository.create({
      key: FAQ_PAGE_KEY,
      content: {},
      translations: { en: {} }
    })
  } catch (error) {
    if (error?.code === 11000) {
      return faqPageRepository.findOne({ key: FAQ_PAGE_KEY })
    }

    throw error
  }
}

async function getAdminFaqPage() {
  const faqPage = await getOrCreateFaqPage()
  const plainFaqPage = toPlainObject(faqPage)

  return {
    message: 'FAQ page content fetched successfully',
    data: {
      ...plainFaqPage,
      content: isPlainObject(plainFaqPage.content) ? plainFaqPage.content : {},
      translations: normalizeTranslations(plainFaqPage.translations)
    }
  }
}

async function getClientFaqPage(language = 'vi') {
  const normalizedLanguage = normalizeLanguage(language)

  return cache.getOrSet(
    `faq-page:${normalizedLanguage}`,
    async () => {
      const faqPage = await getOrCreateFaqPage()
      const plainFaqPage = toPlainObject(faqPage)
      const content = isPlainObject(plainFaqPage.content) ? plainFaqPage.content : {}
      const translations = normalizeTranslations(plainFaqPage.translations)

      return {
        message: 'FAQ page content fetched successfully',
        data: normalizedLanguage === 'en' ? deepMergeLocalized(content, translations.en) : content
      }
    },
    300
  )
}

async function updateFaqPage(payload = {}, user = null) {
  if (!isPlainObject(payload.content)) {
    throw new AppError('FAQ page content is required', 400)
  }

  const faqPage = await getOrCreateFaqPage()
  faqPage.content = deepClean(payload.content)
  faqPage.translations = normalizeTranslations(payload.translations)
  faqPage.updatedBy = user?.userId || user?.id || null

  await faqPage.save()
  await cache.del(FAQ_PAGE_CACHE_PATTERN)

  return {
    message: 'FAQ page content updated successfully',
    data: {
      ...toPlainObject(faqPage),
      content: faqPage.content,
      translations: normalizeTranslations(faqPage.translations)
    }
  }
}

module.exports = {
  getAdminFaqPage,
  getClientFaqPage,
  updateFaqPage
}
