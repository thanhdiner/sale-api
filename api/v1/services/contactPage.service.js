const cache = require('../../../config/redis')
const contactPageRepository = require('../repositories/contactPage.repository')
const AppError = require('../utils/AppError')
const {
  DEFAULT_CONTACT_PAGE_CONTENT,
  DEFAULT_CONTACT_PAGE_TRANSLATIONS
} = require('../utils/contactPageDefaults')

const CONTACT_PAGE_KEY = 'contact-page'
const CONTACT_PAGE_CACHE_PATTERN = 'contact-page:*'

const isPlainObject = value =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const clone = value => JSON.parse(JSON.stringify(value))

function deepMergeDefaults(defaultValue, value) {
  if (Array.isArray(defaultValue)) {
    return Array.isArray(value) ? value.map(item => deepClean(item)) : clone(defaultValue)
  }

  if (isPlainObject(defaultValue)) {
    const source = isPlainObject(value) ? value : {}
    const merged = {}

    Object.keys(defaultValue).forEach(key => {
      merged[key] = deepMergeDefaults(defaultValue[key], source[key])
    })

    Object.keys(source).forEach(key => {
      if (!Object.prototype.hasOwnProperty.call(merged, key)) {
        merged[key] = deepClean(source[key])
      }
    })

    return merged
  }

  return value === undefined || value === null ? defaultValue : value
}

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
    return Array.from({ length }, (_, index) => {
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

function toPlainObject(document) {
  if (!document) return document
  return document.toObject ? document.toObject() : document
}

function normalizeContent(content) {
  return deepMergeDefaults(DEFAULT_CONTACT_PAGE_CONTENT, content)
}

function normalizeTranslations(translations = {}) {
  return {
    en: deepMergeDefaults(DEFAULT_CONTACT_PAGE_TRANSLATIONS.en, translations?.en)
  }
}

async function getOrCreateContactPage() {
  const existing = await contactPageRepository.findOne({ key: CONTACT_PAGE_KEY })
  if (existing) return existing

  try {
    return await contactPageRepository.create({
      key: CONTACT_PAGE_KEY,
      content: clone(DEFAULT_CONTACT_PAGE_CONTENT),
      translations: clone(DEFAULT_CONTACT_PAGE_TRANSLATIONS)
    })
  } catch (error) {
    if (error?.code === 11000) {
      return contactPageRepository.findOne({ key: CONTACT_PAGE_KEY })
    }

    throw error
  }
}

async function getAdminContactPage() {
  const contactPage = await getOrCreateContactPage()
  const plainContactPage = toPlainObject(contactPage)

  return {
    message: 'Contact page content fetched successfully',
    data: {
      ...plainContactPage,
      content: normalizeContent(plainContactPage.content),
      translations: normalizeTranslations(plainContactPage.translations)
    }
  }
}

async function getClientContactPage(language = 'vi') {
  const normalizedLanguage = String(language || '').toLowerCase().startsWith('en') ? 'en' : 'vi'

  return cache.getOrSet(
    `contact-page:${normalizedLanguage}`,
    async () => {
      const contactPage = await getOrCreateContactPage()
      const plainContactPage = toPlainObject(contactPage)
      const content = normalizeContent(plainContactPage.content)
      const translations = normalizeTranslations(plainContactPage.translations)
      const localizedContent =
        normalizedLanguage === 'en'
          ? deepMergeLocalized(content, translations.en)
          : content

      return {
        message: 'Contact page content fetched successfully',
        data: localizedContent
      }
    },
    300
  )
}

async function updateContactPage(payload = {}, user = null) {
  if (!isPlainObject(payload.content)) {
    throw new AppError('Contact page content is required', 400)
  }

  const contactPage = await getOrCreateContactPage()
  contactPage.content = normalizeContent(payload.content)
  contactPage.translations = normalizeTranslations(payload.translations)
  contactPage.updatedBy = user?.userId || user?.id || null

  await contactPage.save()
  await cache.del(CONTACT_PAGE_CACHE_PATTERN)

  return {
    message: 'Contact page content updated successfully',
    data: {
      ...toPlainObject(contactPage),
      content: normalizeContent(contactPage.content),
      translations: normalizeTranslations(contactPage.translations)
    }
  }
}

module.exports = {
  getAdminContactPage,
  getClientContactPage,
  updateContactPage
}
