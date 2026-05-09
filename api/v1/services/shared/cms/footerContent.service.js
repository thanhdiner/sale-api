const footerContentRepository = require('../../../repositories/cms/footerContent.repository')
const {
  createKeyedPageContentModule,
  deepClean,
  isPlainObject
} = require('../../../factories/singletonContent.factory')

const FOOTER_CONTENT_KEY = 'footer-content'
const FOOTER_CONTENT_CACHE_PATTERN = 'footer-content:*'

function normalizeTranslations(translations = {}) {
  return {
    en: isPlainObject(translations?.en) ? deepClean(translations.en) : {}
  }
}

const { service } = createKeyedPageContentModule({
  repository: footerContentRepository,
  key: FOOTER_CONTENT_KEY,
  normalizeContent: content => (isPlainObject(content) ? deepClean(content) : {}),
  normalizeTranslations,
  messages: {
    fetched: 'Footer content fetched successfully',
    updated: 'Footer content updated successfully'
  },
  requiredMessage: 'Footer content is required',
  cacheKey: ({ language }) => `footer-content:${language}`,
  cachePattern: FOOTER_CONTENT_CACHE_PATTERN
})

module.exports = {
  getAdminFooterContent: service.getAdminContent,
  getClientFooterContent: service.getClientContent,
  updateFooterContent: service.updateContent
}










