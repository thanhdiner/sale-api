/**
 * Date and money formatting helpers for AI tool executors.
 */

function serializeDate(value) {
  if (!value) return null
  if (value instanceof Date) return value.toISOString()
  return value
}

function formatDate(value) {
  if (!value) return null
  return new Date(value).toLocaleDateString('vi-VN')
}

function formatPrice(amount) {
  if (amount == null) return '0₫'
  return new Intl.NumberFormat('vi-VN').format(amount) + '₫'
}

// ─── Tool Registry (map name → executor function) ───────────────────────────

module.exports = {
  serializeDate,
  formatDate,
  formatPrice
}
