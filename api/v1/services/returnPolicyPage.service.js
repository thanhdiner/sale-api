const cache = require('../../../config/redis')
const returnPolicyPageRepository = require('../repositories/returnPolicyPage.repository')
const AppError = require('../utils/AppError')

const RETURN_POLICY_PAGE_KEY = 'return-policy-page'
const RETURN_POLICY_PAGE_CACHE_PATTERN = 'return-policy-page:*'

const isPlainObject = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value)

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

function toPlainObject(document) {
  if (!document) return document
  return document.toObject ? document.toObject() : document
}

function normalizeTranslations(translations = {}) {
  return {
    en: deepClean(translations?.en || {})
  }
}

async function getOrCreateReturnPolicyPage() {
  const existing = await returnPolicyPageRepository.findOne({ key: RETURN_POLICY_PAGE_KEY })
  if (existing) return existing

  try {
    return await returnPolicyPageRepository.create({
      key: RETURN_POLICY_PAGE_KEY,
      content: {},
      translations: { en: {} }
    })
  } catch (error) {
    if (error?.code === 11000) {
      return returnPolicyPageRepository.findOne({ key: RETURN_POLICY_PAGE_KEY })
    }

    throw error
  }
}

async function getAdminReturnPolicyPage() {
  const returnPolicyPage = await getOrCreateReturnPolicyPage()
  const plainReturnPolicyPage = toPlainObject(returnPolicyPage)

  return {
    message: 'Return policy page content fetched successfully',
    data: {
      ...plainReturnPolicyPage,
      content: deepClean(plainReturnPolicyPage.content || {}),
      translations: normalizeTranslations(plainReturnPolicyPage.translations)
    }
  }
}

async function getClientReturnPolicyPage(language = 'vi') {
  const normalizedLanguage = String(language || '').toLowerCase().startsWith('en') ? 'en' : 'vi'

  return cache.getOrSet(
    `return-policy-page:${normalizedLanguage}`,
    async () => {
      const returnPolicyPage = await getOrCreateReturnPolicyPage()
      const plainReturnPolicyPage = toPlainObject(returnPolicyPage)
      const content = deepClean(plainReturnPolicyPage.content || {})
      const translations = normalizeTranslations(plainReturnPolicyPage.translations)
      const localizedContent =
        normalizedLanguage === 'en'
          ? deepMergeLocalized(content, translations.en)
          : content

      return {
        message: 'Return policy page content fetched successfully',
        data: localizedContent
      }
    },
    300
  )
}

async function updateReturnPolicyPage(payload = {}, user = null) {
  if (!isPlainObject(payload.content)) {
    throw new AppError('Return policy page content is required', 400)
  }

  const returnPolicyPage = await getOrCreateReturnPolicyPage()
  returnPolicyPage.content = deepClean(payload.content)
  returnPolicyPage.translations = normalizeTranslations(payload.translations)
  returnPolicyPage.updatedBy = user?.userId || user?.id || null

  await returnPolicyPage.save()
  await cache.del(RETURN_POLICY_PAGE_CACHE_PATTERN)

  return {
    message: 'Return policy page content updated successfully',
    data: {
      ...toPlainObject(returnPolicyPage),
      content: deepClean(returnPolicyPage.content || {}),
      translations: normalizeTranslations(returnPolicyPage.translations)
    }
  }
}

module.exports = {
  getAdminReturnPolicyPage,
  getClientReturnPolicyPage,
  updateReturnPolicyPage
}
