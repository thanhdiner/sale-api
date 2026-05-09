const termsContentRepository = require('../../../repositories/cms/termsContent.repository')
const { createSingletonContentModule } = require('../../../factories/singletonContent.factory')

const TTL_TERMS_CONTENT = 600

const { service } = createSingletonContentModule({
  repository: termsContentRepository,
  messages: {
    fetched: 'Terms content fetched successfully'
  },
  cacheKey: ({ language }) => `terms:content:${language}`,
  ttl: TTL_TERMS_CONTENT
})

module.exports = {
  getTermsContent: service.getClientContent
}











