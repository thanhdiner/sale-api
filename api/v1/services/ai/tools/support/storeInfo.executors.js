const {
  CLIENT_URL,
  logger,
  normalizePolicyLanguage,
  pickString,
  toPlainObject,
  websiteConfigRepository,
  buildSupportInfoPayload,
  buildStoreLocationsPayload
} = require('./support.helpers')

async function getStoreConfig({ language } = {}, context = {}) {
  try {
    const normalizedLanguage = normalizePolicyLanguage(language, context)
    const config = await websiteConfigRepository.findOne({}, { lean: true })

    if (!config) {
      return JSON.stringify({
        found: false,
        message: 'Chua co website config.'
      })
    }

    const source = toPlainObject(config)
    const supportInfo = buildSupportInfoPayload(source, normalizedLanguage)

    return JSON.stringify({
      found: true,
      language: normalizedLanguage,
      store: {
        siteName: pickString(source.siteName) || null,
        type: pickString(source.type) || null,
        description: pickString(source.description) || null,
        website: supportInfo.website || CLIENT_URL,
        logoUrl: pickString(source.logoUrl) || null,
        faviconUrl: pickString(source.faviconUrl) || null
      },
      supportInfo,
      message: supportInfo.hasSupportInfo
        ? 'Da lay cau hinh cua hang tu website config.'
        : 'Website config chua co hotline, email, gio ho tro hoac mang xa hoi.'
    })
  } catch (err) {
    logger.error('[AI Tool] getStoreConfig error:', err.message)
    return JSON.stringify({
      found: false,
      message: 'Khong the lay cau hinh cua hang luc nay.',
      error: 'Loi khi lay website config.'
    })
  }
}

async function getSupportInfo({ language } = {}, context = {}) {
  try {
    const normalizedLanguage = normalizePolicyLanguage(language, context)
    const config = await websiteConfigRepository.findOne({}, { lean: true })

    if (!config) {
      return JSON.stringify({
        found: false,
        configFound: false,
        message: 'Chua co website config.'
      })
    }

    const supportInfo = buildSupportInfoPayload(config, normalizedLanguage)

    return JSON.stringify({
      found: supportInfo.hasSupportInfo,
      configFound: true,
      language: normalizedLanguage,
      ...supportInfo,
      message: supportInfo.hasSupportInfo
        ? 'Da lay thong tin ho tro tu website config.'
        : 'Website config chua co hotline, email, gio ho tro hoac mang xa hoi.'
    })
  } catch (err) {
    logger.error('[AI Tool] getSupportInfo error:', err.message)
    return JSON.stringify({
      found: false,
      message: 'Khong the lay thong tin ho tro luc nay.',
      error: 'Loi khi lay website config.'
    })
  }
}

async function getStoreLocations({ language, city, keyword, limit } = {}, context = {}) {
  try {
    const normalizedLanguage = normalizePolicyLanguage(language, context)
    const config = await websiteConfigRepository.findOne({}, { lean: true })

    if (!config) {
      return JSON.stringify({
        found: false,
        configFound: false,
        message: 'Chua co website config.'
      })
    }

    return JSON.stringify(buildStoreLocationsPayload(config, {
      language: normalizedLanguage,
      city,
      keyword,
      limit
    }))
  } catch (err) {
    logger.error('[AI Tool] getStoreLocations error:', err.message)
    return JSON.stringify({
      found: false,
      message: 'Khong the lay dia diem cua hang luc nay.',
      error: 'Loi khi lay dia diem cua hang.'
    })
  }
}

module.exports = {
  getStoreConfig,
  getSupportInfo,
  getStoreLocations
}










