/**
 * Policy and localized content helpers for AI tool executors.
 */

const { pickString } = require('./text.helpers')

function normalizePolicyLanguage(language, context = {}) {
  const rawLanguage = language || context?.language || context?.customerInfo?.language || context?.customerInfo?.lang
  return String(rawLanguage || '').toLowerCase().startsWith('en') ? 'en' : 'vi'
}



function isPlainPolicyObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function getGuidePath(source, path) {
  return String(path || '')
    .split('.')
    .filter(Boolean)
    .reduce((result, key) => (result == null ? result : result[key]), source)
}

function getGuideLocalizedRoot(config = {}, language = 'vi') {
  return language === 'en' ? config.translations?.en || {} : {}
}

function getGuideText(config = {}, localizedRoot = {}, path, fallback = '') {
  return pickString(getGuidePath(localizedRoot, path), getGuidePath(config, path), fallback)
}

module.exports = {
  normalizePolicyLanguage,
  isPlainPolicyObject,
  getGuidePath,
  getGuideLocalizedRoot,
  getGuideText
}










