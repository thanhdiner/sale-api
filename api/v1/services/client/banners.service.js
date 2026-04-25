const cache = require('../../../../config/redis')
const bannerRepository = require('../../repositories/banner.repository')

async function listActiveBanners() {
  return cache.getOrSet(
    'banners:active',
    async () => {
      const banners = await bannerRepository.findAll({ isActive: true }, { sort: { order: 1 } })
      return { message: 'Banners fetched successfully', data: banners }
    },
    600
  )
}

module.exports = {
  listActiveBanners
}
