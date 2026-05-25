const websiteConfigRepository = require('../../../repositories/system/websiteConfig.repository')
const AppError = require('../../../utils/AppError')

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

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function toPlainObject(value) {
  if (!isPlainObject(value)) {
    return {}
  }

  if (typeof value.toObject === 'function') {
    return value.toObject({ depopulate: true, versionKey: false })
  }

  return { ...value }
}

function mergeDefinedDeep(currentValue, patchValue) {
  if (patchValue === undefined) {
    return currentValue
  }

  if (!isPlainObject(patchValue)) {
    return patchValue
  }

  const merged = toPlainObject(currentValue)

  Object.entries(patchValue).forEach(([key, value]) => {
    if (value === undefined) {
      return
    }

    merged[key] = isPlainObject(value)
      ? mergeDefinedDeep(merged[key], value)
      : value
  })

  return merged
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
    dailySuggestionBannerImg,
    shoppingGuide,
    specialPackage
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
    config.dailySuggestionBanner = mergeDefinedDeep(config.dailySuggestionBanner, bannerObj)
  }

  if (typeof dailySuggestionBannerImg === 'string' && dailySuggestionBannerImg.trim() !== '') {
    config.dailySuggestionBanner = {
      ...config.dailySuggestionBanner,
      imageUrl: dailySuggestionBannerImg
    }
  }

  if (shoppingGuide !== undefined) {
    config.shoppingGuide = mergeDefinedDeep(config.shoppingGuide, parseJsonField(shoppingGuide, 'shoppingGuide'))
  }

  if (specialPackage !== undefined) {
    config.specialPackage = mergeDefinedDeep(config.specialPackage, parseJsonField(specialPackage, 'specialPackage'))
  }


  if (siteName !== undefined) config.siteName = siteName
  if (tagline !== undefined) config.tagline = tagline
  if (description !== undefined) config.description = description
  if (contactObj !== undefined) config.contactInfo = mergeDefinedDeep(config.contactInfo, contactObj)
  if (seoObj !== undefined) config.seoSettings = mergeDefinedDeep(config.seoSettings, seoObj)

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












