const homeWhyChooseUsContentRepository = require('../../repositories/homeWhyChooseUsContent.repository')
const { createSingletonContentModule } = require('../../factories/singletonContent.factory')

const TTL_HOME_WHY_CHOOSE_US_CONTENT = 600

const { service } = createSingletonContentModule({
  repository: homeWhyChooseUsContentRepository,
  messages: {
    fetched: 'Home why choose us content fetched successfully'
  },
  cacheKey: ({ language }) => `home-why-choose-us:content:${language}`,
  ttl: TTL_HOME_WHY_CHOOSE_US_CONTENT
})

module.exports = {
  getHomeWhyChooseUsContent: service.getClientContent
}
