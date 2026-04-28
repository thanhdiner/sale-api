const contactPageRepository = require('../repositories/contactPage.repository')
const {
  clone,
  createKeyedPageContentModule,
  deepClean,
  isPlainObject
} = require('../factories/singletonContent.factory')
const {
  DEFAULT_CONTACT_PAGE_CONTENT,
  DEFAULT_CONTACT_PAGE_TRANSLATIONS
} = require('../utils/contactPageDefaults')

const CONTACT_PAGE_KEY = 'contact-page'
const CONTACT_PAGE_CACHE_PATTERN = 'contact-page:*'

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

function normalizeContent(content) {
  return deepMergeDefaults(DEFAULT_CONTACT_PAGE_CONTENT, content)
}

function normalizeTranslations(translations = {}) {
  return {
    en: deepMergeDefaults(DEFAULT_CONTACT_PAGE_TRANSLATIONS.en, translations?.en)
  }
}

const { service } = createKeyedPageContentModule({
  repository: contactPageRepository,
  key: CONTACT_PAGE_KEY,
  defaultContent: DEFAULT_CONTACT_PAGE_CONTENT,
  defaultTranslations: DEFAULT_CONTACT_PAGE_TRANSLATIONS,
  normalizeContent,
  normalizeTranslations,
  messages: {
    fetched: 'Contact page content fetched successfully',
    updated: 'Contact page content updated successfully'
  },
  requiredMessage: 'Contact page content is required',
  cacheKey: ({ language }) => `contact-page:${language}`,
  cachePattern: CONTACT_PAGE_CACHE_PATTERN
})

module.exports = {
  getAdminContactPage: service.getAdminContent,
  getClientContactPage: service.getClientContent,
  updateContactPage: service.updateContent
}
