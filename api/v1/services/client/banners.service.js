const cache = require('../../../../config/redis')
const bannerRepository = require('../../repositories/banner.repository')
const applyTranslation = require('../../utils/applyTranslation')

const BANNER_TRANSLATION_FIELDS = ['title', 'link']

function normalizeLanguage(language) {
  return String(language || '').toLowerCase().startsWith('en') ? 'en' : 'vi'
}

async function listActiveBanners(language = 'vi') {
  const normalizedLanguage = normalizeLanguage(language)

  return cache.getOrSet(
    `banners:active:${normalizedLanguage}`,
    async () => {
      const banners = await bannerRepository.findAll({ isActive: true }, { sort: { order: 1 } })
      return {
        message: 'Banners fetched successfully',
        data: banners.map(banner => applyTranslation(banner, normalizedLanguage, BANNER_TRANSLATION_FIELDS))
      }
    },
    600
  )
}

module.exports = {
  listActiveBanners
}
