const gameAccountContentRepository = require('../repositories/gameAccountContent.repository')
const {
  cleanString,
  cleanText,
  createSingletonContentModule
} = require('../factories/singletonContent.factory')

const GAME_ACCOUNT_CONTENT_CACHE_PATTERN = 'game-account:content:*'
const TTL_GAME_ACCOUNT_CONTENT = 600

function normalizeContent(payload = {}) {
  return {
    seo: {
      title: cleanString(payload.seo?.title),
      description: cleanText(payload.seo?.description)
    },
    eyebrow: cleanString(payload.eyebrow),
    title: cleanString(payload.title),
    description: cleanText(payload.description),
    note: cleanText(payload.note)
  }
}

function normalizeTranslations(translations = {}) {
  return {
    en: normalizeContent(translations.en || {})
  }
}

const { service } = createSingletonContentModule({
  repository: gameAccountContentRepository,
  normalizeContent,
  normalizeTranslations,
  messages: {
    fetched: 'Game account content fetched successfully',
    saved: 'Game account content saved successfully'
  },
  cacheKey: ({ language }) => `game-account:content:${language}`,
  cachePattern: GAME_ACCOUNT_CONTENT_CACHE_PATTERN,
  ttl: TTL_GAME_ACCOUNT_CONTENT
})

module.exports = {
  getAdminGameAccountContent: service.getAdminContent,
  getClientGameAccountContent: service.getClientContent,
  updateGameAccountContent: service.updateContent
}
