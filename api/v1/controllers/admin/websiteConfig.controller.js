const WebsiteConfig = require('../../models/adminWebsiteConfig.model')
const logger = require('../../../../config/logger')

//#GET /api/v1/admin/website-config
exports.index = async (req, res) => {
  try {
    const config = await WebsiteConfig.findOne()
    res.status(200).json(config)
  } catch (error) {
    res.status(500).json({ message: 'Failed to retrieve website config' })
  }
}

//#PATCH /admin/website-config/edit
module.exports.edit = async (req, res) => {
  try {
    const { siteName, tagline, description, contactInfo, seoSettings, logo, favicon, dailySuggestionBanner, dailySuggestionBannerImg } = req.body

    const contactObj = typeof contactInfo === 'string' ? JSON.parse(contactInfo) : contactInfo
    const seoObj = typeof seoSettings === 'string' ? JSON.parse(seoSettings) : seoSettings

    const config = await WebsiteConfig.findOne()

    if (typeof logo === 'string' && logo.trim() !== '') config.logoUrl = logo
    if (typeof favicon === 'string' && favicon.trim() !== '') config.faviconUrl = favicon
    
    // Xử lý banner
    if (dailySuggestionBanner) {
      const bannerObj = typeof dailySuggestionBanner === 'string' ? JSON.parse(dailySuggestionBanner) : dailySuggestionBanner
      config.dailySuggestionBanner = { ...config.dailySuggestionBanner, ...bannerObj }
    }
    if (typeof dailySuggestionBannerImg === 'string' && dailySuggestionBannerImg.trim() !== '') {
      config.dailySuggestionBanner = { ...config.dailySuggestionBanner, imageUrl: dailySuggestionBannerImg }
    }

    config.siteName = siteName
    config.tagline = tagline
    config.description = description
    config.contactInfo = contactObj
    config.seoSettings = seoObj

    await config.save()
    return res.json({ success: true, message: 'Cập nhật cấu hình thành công!', data: config })
  } catch (err) {
    logger.error('[Admin] Update config error:', err)
    res.status(500).json({ success: false, message: 'Cập nhật cấu hình thất bại!' })
  }
}
