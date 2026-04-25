const websiteConfigRepository = require('../../repositories/websiteConfig.repository')
const AppError = require('../../utils/AppError')

function parseJsonField(value, fieldName) {
  if (typeof value !== 'string') {
    return value
  }

  try {
    return JSON.parse(value)
  } catch {
    throw new AppError(`${fieldName} is invalid JSON`, 400)
  }
}

async function getWebsiteConfig() {
  return websiteConfigRepository.findOne()
}

async function updateWebsiteConfig(payload = {}) {
  const {
    siteName,
    tagline,
    description,
    contactInfo,
    seoSettings,
    logo,
    favicon,
    dailySuggestionBanner,
    dailySuggestionBannerImg
  } = payload

  const contactObj = parseJsonField(contactInfo, 'contactInfo')
  const seoObj = parseJsonField(seoSettings, 'seoSettings')

  const config = await websiteConfigRepository.findOne()
  if (!config) {
    throw new AppError('Website config not found', 404)
  }

  if (typeof logo === 'string' && logo.trim() !== '') config.logoUrl = logo
  if (typeof favicon === 'string' && favicon.trim() !== '') config.faviconUrl = favicon

  if (dailySuggestionBanner) {
    const bannerObj = parseJsonField(dailySuggestionBanner, 'dailySuggestionBanner')
    config.dailySuggestionBanner = { ...config.dailySuggestionBanner, ...bannerObj }
  }

  if (typeof dailySuggestionBannerImg === 'string' && dailySuggestionBannerImg.trim() !== '') {
    config.dailySuggestionBanner = {
      ...config.dailySuggestionBanner,
      imageUrl: dailySuggestionBannerImg
    }
  }

  config.siteName = siteName
  config.tagline = tagline
  config.description = description
  config.contactInfo = contactObj
  config.seoSettings = seoObj

  await config.save()

  return {
    success: true,
    message: 'Cap nhat cau hinh thanh cong!',
    data: config
  }
}

module.exports = {
  getWebsiteConfig,
  updateWebsiteConfig
}
