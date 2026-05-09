/**
 * Text, id, and payload helpers for AI tool executors.
 */

const { removeAccents } = require('./dependencies')

function normalizeSearchText(value = '') {
  return removeAccents(String(value || '').toLowerCase())
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function escapeRegExp(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function isMongoObjectId(value) {
  return /^[0-9a-f]{24}$/i.test(String(value || '').trim())
}

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizePasswordResetEmail(value) {
  const email = cleanString(value).toLowerCase()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : ''
}

function normalizeEnum(value, allowedValues, fallback) {
  const normalized = cleanString(value)
  return allowedValues.includes(normalized) ? normalized : fallback
}

function normalizeIntentText(value = '') {
  return removeAccents(String(value || '').toLowerCase())
}

function pickString(...values) {
  for (const value of values) {
    const normalized = cleanString(value)
    if (normalized) return normalized
  }

  return ''
}

function normalizePhone(value) {
  return cleanString(value).replace(/[\s\-.]/g, '')
}

function hasOwnProperty(object, field) {
  return Object.prototype.hasOwnProperty.call(object || {}, field)
}

function toPlainObject(value) {
  if (value && typeof value.toObject === 'function') return value.toObject()
  return value || {}
}

function serializeId(value) {
  if (!value) return ''
  return typeof value.toString === 'function' ? value.toString() : cleanString(value)
}

function serializeDate(value) {
  if (!value) return null
  if (value instanceof Date) return value.toISOString()
  return value
}

function parseToolPayload(payload) {
  if (payload == null) return null
  if (typeof payload !== 'string') return payload

  try {
    return JSON.parse(payload)
  } catch {
    return { raw: payload }
  }
}

function excerptText(text, maxLength = 180) {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim()
  if (!normalized) return ''
  if (normalized.length <= maxLength) return normalized
  return `${normalized.slice(0, maxLength - 1).trim()}…`
}

function maskEmail(value = '') {
  const email = cleanString(value).toLowerCase()
  const [localPart, domain] = email.split('@')
  if (!localPart || !domain) return ''

  const visibleLocal = localPart.length <= 2
    ? `${localPart[0] || '*'}*`
    : `${localPart.slice(0, 2)}***`

  return `${visibleLocal}@${domain}`
}

function truncateHandoffText(value, maxLength) {
  const normalized = cleanString(value)
  return normalized.length > maxLength
    ? normalized.slice(0, maxLength).trim()
    : normalized
}

module.exports = {
  normalizeSearchText,
  escapeRegExp,
  isMongoObjectId,
  cleanString,
  normalizePasswordResetEmail,
  normalizeEnum,
  normalizeIntentText,
  pickString,
  normalizePhone,
  hasOwnProperty,
  toPlainObject,
  serializeId,
  parseToolPayload,
  excerptText,
  maskEmail,
  truncateHandoffText
}










