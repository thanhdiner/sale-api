const vipContentRepository = require('../../repositories/vipContent.repository')
const { createSingletonContentModule } = require('../../factories/singletonContent.factory')

const TTL_VIP_CONTENT = 600

const { service } = createSingletonContentModule({
  repository: vipContentRepository,
  messages: {
    fetched: 'VIP content fetched successfully'
  },
  cacheKey: ({ language }) => `vip:content:${language}`,
  ttl: TTL_VIP_CONTENT
})

module.exports = {
  getVipContent: service.getClientContent
}
