const cache = require('../../../../../config/redis')
const AppError = require('../../../utils/AppError')
const bankInfoRepository = require('../../../repositories/commerce/bankInfo.repository')
const applyTranslation = require('../../../utils/applyTranslation')

const BANK_INFO_TRANSLATION_FIELDS = ['bankName', 'accountHolder', 'noteTemplate']

function normalizeLanguage(lang) {
  return String(lang || '').toLowerCase().startsWith('en') ? 'en' : 'vi'
}

function localizeBankInfo(bankInfo, lang) {
  return applyTranslation(bankInfo, normalizeLanguage(lang), BANK_INFO_TRANSLATION_FIELDS)
}

async function getActiveBankInfo(lang = 'vi') {
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
    throw new AppError('No active bank info', 404)
  }

  return {
    ...result,
    bankInfo: localizeBankInfo(result.bankInfo, lang)
  }
}

module.exports = {
  getActiveBankInfo
}











