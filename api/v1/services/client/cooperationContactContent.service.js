const cooperationContactContentRepository = require('../../repositories/cooperationContactContent.repository')
const { createSingletonContentModule } = require('../../factories/singletonContent.factory')

const TTL_COOPERATION_CONTACT_CONTENT = 600

const { service } = createSingletonContentModule({
  repository: cooperationContactContentRepository,
  messages: {
    fetched: 'Cooperation contact content fetched successfully'
  },
  cacheKey: ({ language }) => `cooperation-contact:content:${language}`,
  ttl: TTL_COOPERATION_CONTACT_CONTENT
})

module.exports = {
  getCooperationContactContent: service.getClientContent
}
