const aboutContentRepository = require('../../../repositories/cms/aboutContent.repository')
const { createSingletonContentModule } = require('../../../factories/singletonContent.factory')

const TTL_ABOUT_CONTENT = 600

const { service } = createSingletonContentModule({
  repository: aboutContentRepository,
  messages: {
    fetched: 'About content fetched successfully'
  },
  cacheKey: ({ language }) => `about:content:${language}`,
  ttl: TTL_ABOUT_CONTENT
})

module.exports = {
  getAboutContent: service.getClientContent
}











