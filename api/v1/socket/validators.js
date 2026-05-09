/**
 * Input validation cho socket events
 */

const ALLOWED_REACTION_EMOJIS = new Set(['👍', '❤️', '😂', '😮', '😢', '🙏'])

/**
 * Validate string field: phải có giá trị, trim, giới hạn length
 */
function validateString(value, fieldName, { maxLength = 5000, required = true } = {}) {
  if (value === undefined || value === null || typeof value !== 'string') {
    if (required) throw new Error(`${fieldName} là bắt buộc`)
    return null
  }
  const trimmed = value.trim()
  if (required && trimmed.length === 0) {
    throw new Error(`${fieldName} không được rỗng`)
  }
  if (trimmed.length > maxLength) {
    throw new Error(`${fieldName} vượt quá ${maxLength} ký tự`)
  }
  return trimmed
}

/**
 * Validate sessionId: chuỗi non-empty, không chứa ký tự đặc biệt nguy hiểm
 */
function validateSessionId(sessionId) {
  const val = validateString(sessionId, 'sessionId', { maxLength: 200 })
  if (!/^[a-zA-Z0-9_\-:.]+$/.test(val)) {
    throw new Error('sessionId chứa ký tự không hợp lệ')
  }
  return val
}

/**
 * Validate MongoDB ObjectId string (24 hex chars)
 */
function validateObjectId(value, fieldName, { required = false } = {}) {
  if (!value) {
    if (required) throw new Error(`${fieldName} là bắt buộc`)
    return null
  }
  if (typeof value !== 'string' || !/^[a-f\d]{24}$/i.test(value)) {
    throw new Error(`${fieldName} không phải ObjectId hợp lệ`)
  }
  return value
}

function validateReactionEmoji(value) {
  const emoji = validateString(value, 'emoji', { maxLength: 12 })

  if (!ALLOWED_REACTION_EMOJIS.has(emoji)) {
    throw new Error('emoji khong hop le')
  }

  return emoji
}

module.exports = { validateString, validateSessionId, validateObjectId, validateReactionEmoji }









