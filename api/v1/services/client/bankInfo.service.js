const cache = require('../../../../config/redis')
const AppError = require('../../utils/AppError')
const bankInfoRepository = require('../../repositories/bankInfo.repository')

async function getActiveBankInfo() {
  const result = await cache.getOrSet(
    'bankinfo:active',
    async () => {
      const active = await bankInfoRepository.findLatestActive()

      if (!active) {
        return null
      }

      return { success: true, bankInfo: active }
    },
    300
  )

  if (!result) {
    throw new AppError('Không có bank info đang dùng', 404)
  }

  return result
}

module.exports = {
  getActiveBankInfo
}
