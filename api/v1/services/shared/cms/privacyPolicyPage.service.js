const privacyPolicyPageRepository = require('../../../repositories/cms/privacyPolicyPage.repository')
const {
  createKeyedPageContentModule,
  deepClean,
  isPlainObject
} = require('../../../factories/singletonContent.factory')

const PRIVACY_POLICY_KEY = 'privacy-policy'
const PRIVACY_POLICY_CACHE_PATTERN = 'privacy-policy:*'

function normalizeTranslations(translations = {}) {
  return {
    en: isPlainObject(translations?.en) ? deepClean(translations.en) : {}
  }
}

const { service } = createKeyedPageContentModule({
  repository: privacyPolicyPageRepository,
  key: PRIVACY_POLICY_KEY,
  normalizeContent: content => (isPlainObject(content) ? deepClean(content) : {}),
  normalizeTranslations,
  messages: {
    fetched: 'Privacy policy content fetched successfully',
    updated: 'Privacy policy content updated successfully'
  },
  requiredMessage: 'Privacy policy content is required',
  cacheKey: ({ language }) => `privacy-policy:${language}`,
  cachePattern: PRIVACY_POLICY_CACHE_PATTERN
})

module.exports = {
  getAdminPrivacyPolicyPage: service.getAdminContent,
  getClientPrivacyPolicyPage: service.getClientContent,
  updatePrivacyPolicyPage: service.updateContent
}










