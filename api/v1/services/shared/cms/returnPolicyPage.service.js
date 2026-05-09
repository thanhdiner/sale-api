const returnPolicyPageRepository = require('../../../repositories/cms/returnPolicyPage.repository')
const {
  createKeyedPageContentModule,
  deepClean
} = require('../../../factories/singletonContent.factory')

const RETURN_POLICY_PAGE_KEY = 'return-policy-page'
const RETURN_POLICY_PAGE_CACHE_PATTERN = 'return-policy-page:*'

function normalizeTranslations(translations = {}) {
  return {
    en: deepClean(translations?.en || {})
  }
}

const { service } = createKeyedPageContentModule({
  repository: returnPolicyPageRepository,
  key: RETURN_POLICY_PAGE_KEY,
  normalizeContent: content => deepClean(content || {}),
  normalizeTranslations,
  messages: {
    fetched: 'Return policy page content fetched successfully',
    updated: 'Return policy page content updated successfully'
  },
  requiredMessage: 'Return policy page content is required',
  cacheKey: ({ language }) => `return-policy-page:${language}`,
  cachePattern: RETURN_POLICY_PAGE_CACHE_PATTERN
})

module.exports = {
  getAdminReturnPolicyPage: service.getAdminContent,
  getClientReturnPolicyPage: service.getClientContent,
  updateReturnPolicyPage: service.updateContent
}










