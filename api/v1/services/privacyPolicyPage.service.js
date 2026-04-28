const cache = require('../../../config/redis')
const privacyPolicyPageRepository = require('../repositories/privacyPolicyPage.repository')
const AppError = require('../utils/AppError')

const PRIVACY_POLICY_KEY = 'privacy-policy'
const PRIVACY_POLICY_CACHE_PATTERN = 'privacy-policy:*'

const isPlainObject = value =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const clone = value => JSON.parse(JSON.stringify(value || {}))

function deepClean(value) {
  if (Array.isArray(value)) {
    return value.map(item => deepClean(item))
  }

  if (isPlainObject(value)) {
    return Object.keys(value).reduce((cleaned, key) => {
      cleaned[key] = deepClean(value[key])
      return cleaned
    }, {})
  }

  return typeof value === 'string' ? value.trim() : value
}

function hasLocalizedValue(value) {
  if (Array.isArray(value)) return value.length > 0
  return typeof value === 'string' ? value.trim().length > 0 : value !== undefined && value !== null
}

function deepMergeLocalized(baseValue, localizedValue) {
  if (Array.isArray(baseValue)) {
    if (!Array.isArray(localizedValue)) return clone(baseValue)

    const length = Math.max(baseValue.length, localizedValue.length)
    return Array.from({ length }, (_item, index) => {
      const baseItem = baseValue[index]
      const localizedItem = localizedValue[index]

      if (isPlainObject(baseItem) || isPlainObject(localizedItem)) {
        return deepMergeLocalized(baseItem || {}, localizedItem || {})
      }

      return hasLocalizedValue(localizedItem) ? localizedItem : baseItem
    }).filter(item => item !== undefined)
  }

  if (isPlainObject(baseValue)) {
    const localizedObject = isPlainObject(localizedValue) ? localizedValue : {}
    const keys = new Set([...Object.keys(baseValue), ...Object.keys(localizedObject)])
    const merged = {}

    keys.forEach(key => {
      merged[key] = deepMergeLocalized(baseValue[key], localizedObject[key])
    })

    return merged
  }

  return hasLocalizedValue(localizedValue) ? localizedValue : baseValue
}

function normalizeLanguage(language) {
  return String(language || '').toLowerCase().startsWith('en') ? 'en' : 'vi'
}

function toPlainObject(document) {
  if (!document) return document
  return typeof document.toObject === 'function' ? document.toObject() : document
}

function normalizeTranslations(translations = {}) {
  return {
    en: isPlainObject(translations?.en) ? deepClean(translations.en) : {}
  }
}

async function getOrCreatePrivacyPolicyPage() {
  const existing = await privacyPolicyPageRepository.findOne({ key: PRIVACY_POLICY_KEY })
  if (existing) return existing

  try {
    return await privacyPolicyPageRepository.create({
      key: PRIVACY_POLICY_KEY,
      content: {},
      translations: { en: {} }
    })
  } catch (error) {
    if (error?.code === 11000) {
      return privacyPolicyPageRepository.findOne({ key: PRIVACY_POLICY_KEY })
    }

    throw error
  }
}

async function getAdminPrivacyPolicyPage() {
  const privacyPolicyPage = await getOrCreatePrivacyPolicyPage()
  const plainPrivacyPolicyPage = toPlainObject(privacyPolicyPage)

  return {
    message: 'Privacy policy content fetched successfully',
    data: {
      ...plainPrivacyPolicyPage,
      content: isPlainObject(plainPrivacyPolicyPage.content) ? plainPrivacyPolicyPage.content : {},
      translations: normalizeTranslations(plainPrivacyPolicyPage.translations)
    }
  }
}

async function getClientPrivacyPolicyPage(language = 'vi') {
  const normalizedLanguage = normalizeLanguage(language)

  return cache.getOrSet(
    `privacy-policy:${normalizedLanguage}`,
    async () => {
      const privacyPolicyPage = await getOrCreatePrivacyPolicyPage()
      const plainPrivacyPolicyPage = toPlainObject(privacyPolicyPage)
      const content = isPlainObject(plainPrivacyPolicyPage.content) ? plainPrivacyPolicyPage.content : {}
      const translations = normalizeTranslations(plainPrivacyPolicyPage.translations)

      return {
        message: 'Privacy policy content fetched successfully',
        data: normalizedLanguage === 'en' ? deepMergeLocalized(content, translations.en) : content
      }
    },
    300
  )
}

async function updatePrivacyPolicyPage(payload = {}, user = null) {
  if (!isPlainObject(payload.content)) {
    throw new AppError('Privacy policy content is required', 400)
  }

  const privacyPolicyPage = await getOrCreatePrivacyPolicyPage()
  privacyPolicyPage.content = deepClean(payload.content)
  privacyPolicyPage.translations = normalizeTranslations(payload.translations)
  privacyPolicyPage.updatedBy = user?.userId || user?.id || null

  await privacyPolicyPage.save()
  await cache.del(PRIVACY_POLICY_CACHE_PATTERN)

  return {
    message: 'Privacy policy content updated successfully',
    data: {
      ...toPlainObject(privacyPolicyPage),
      content: privacyPolicyPage.content,
      translations: normalizeTranslations(privacyPolicyPage.translations)
    }
  }
}

module.exports = {
  getAdminPrivacyPolicyPage,
  getClientPrivacyPolicyPage,
  updatePrivacyPolicyPage
}
