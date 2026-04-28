const faqPageRepository = require('../repositories/faqPage.repository')
const {
  createKeyedPageContentModule,
  deepClean,
  isPlainObject
} = require('../factories/singletonContent.factory')

const FAQ_PAGE_KEY = 'faq-page'
const FAQ_PAGE_CACHE_PATTERN = 'faq-page:*'

function normalizeTranslations(translations = {}) {
  return {
    en: isPlainObject(translations?.en) ? deepClean(translations.en) : {}
  }
}

const { service } = createKeyedPageContentModule({
  repository: faqPageRepository,
  key: FAQ_PAGE_KEY,
  normalizeContent: content => (isPlainObject(content) ? deepClean(content) : {}),
  normalizeTranslations,
  messages: {
    fetched: 'FAQ page content fetched successfully',
    updated: 'FAQ page content updated successfully'
  },
  requiredMessage: 'FAQ page content is required',
  cacheKey: ({ language }) => `faq-page:${language}`,
  cachePattern: FAQ_PAGE_CACHE_PATTERN
})

module.exports = {
  getAdminFaqPage: service.getAdminContent,
  getClientFaqPage: service.getClientContent,
  updateFaqPage: service.updateContent
}
