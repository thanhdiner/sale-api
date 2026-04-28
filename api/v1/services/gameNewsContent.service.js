const gameNewsContentRepository = require('../repositories/gameNewsContent.repository')
const {
  cleanString,
  cleanText,
  createSingletonContentModule
} = require('../factories/singletonContent.factory')

const GAME_NEWS_CONTENT_CACHE_PATTERN = 'game-news:content:*'
const TTL_GAME_NEWS_CONTENT = 600

function normalizeContent(payload = {}) {
  return {
    seo: {
      title: cleanString(payload.seo?.title),
      description: cleanText(payload.seo?.description)
    },
    title: cleanString(payload.title),
    description: cleanText(payload.description),
    descriptionSecondLine: cleanText(payload.descriptionSecondLine),
    status: cleanString(payload.status)
  }
}

function normalizeTranslations(translations = {}) {
  return {
    en: normalizeContent(translations.en || {})
  }
}

const { service } = createSingletonContentModule({
  repository: gameNewsContentRepository,
  normalizeContent,
  normalizeTranslations,
  messages: {
    fetched: 'Game news content fetched successfully',
    saved: 'Game news content saved successfully'
  },
  cacheKey: ({ language }) => `game-news:content:${language}`,
  cachePattern: GAME_NEWS_CONTENT_CACHE_PATTERN,
  ttl: TTL_GAME_NEWS_CONTENT
})

module.exports = {
  getAdminGameNewsContent: service.getAdminContent,
  getClientGameNewsContent: service.getClientContent,
  updateGameNewsContent: service.updateContent
}
