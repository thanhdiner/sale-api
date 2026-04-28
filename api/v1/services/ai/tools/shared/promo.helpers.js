/**
 * Promo-code helpers for AI tool executors.
 */

const { logger, promoCodeRepository } = require('./dependencies')

const { formatDate, formatPrice } = require('./format.helpers')

const { normalizeUserId } = require('./product.helpers')

async function checkPromoCode({ code, subtotal } = {}, context = {}) {
  try {
    const normalizedCode = String(code || '').trim().toUpperCase()
    if (!normalizedCode) {
      return JSON.stringify({
        valid: false,
        message: 'Vui lòng cung cấp mã giảm giá cần kiểm tra.'
      })
    }

    const userId = normalizeUserId(context)
    const normalizedSubtotal = normalizeSubtotal(subtotal)
    const promo = await promoCodeRepository.findOne({ code: normalizedCode, isActive: true }, { lean: true })

    if (!promo) {
      return JSON.stringify({
        valid: false,
        message: `Không tìm thấy mã ${normalizedCode} hoặc mã này không còn hoạt động.`
      })
    }

    if (promo.userId && String(promo.userId) !== String(userId || '')) {
      return JSON.stringify({
        valid: false,
        message: `Mã ${normalizedCode} không áp dụng cho tài khoản đang chat.`,
        promo: buildPromoPayload(promo)
      })
    }

    if (isPromoExpired(promo)) {
      return JSON.stringify({
        valid: false,
        message: `Mã ${normalizedCode} đã hết hạn.`,
        promo: buildPromoPayload(promo)
      })
    }

    if (isPromoExhausted(promo)) {
      return JSON.stringify({
        valid: false,
        message: `Mã ${normalizedCode} đã hết lượt sử dụng.`,
        promo: buildPromoPayload(promo)
      })
    }

    if (hasUserUsedPromo(promo, userId)) {
      return JSON.stringify({
        valid: false,
        message: `Tài khoản này đã dùng mã ${normalizedCode} rồi.`,
        promo: buildPromoPayload(promo)
      })
    }

    if (normalizedSubtotal === null) {
      return JSON.stringify({
        valid: true,
        needsSubtotal: true,
        message: `Mã ${normalizedCode} đang hoạt động. Mình cần tổng tiền tạm tính để tính chính xác mức giảm.`,
        promo: buildPromoPayload(promo)
      })
    }

    if (normalizedSubtotal < Number(promo.minOrder || 0)) {
      return JSON.stringify({
        valid: false,
        message: `Mã ${normalizedCode} yêu cầu đơn tối thiểu ${formatPrice(promo.minOrder || 0)}.`,
        promo: buildPromoPayload(promo, { subtotal: normalizedSubtotal })
      })
    }

    const discount = calculatePromoDiscount(promo, normalizedSubtotal)

    return JSON.stringify({
      valid: true,
      subtotal: normalizedSubtotal,
      subtotalFormatted: formatPrice(normalizedSubtotal),
      discount,
      discountFormatted: formatPrice(discount),
      estimatedTotalFormatted: formatPrice(Math.max(0, normalizedSubtotal - discount)),
      message: `Mã ${normalizedCode} áp dụng được cho đơn hiện tại.`,
      promo: buildPromoPayload(promo, { subtotal: normalizedSubtotal })
    })
  } catch (err) {
    logger.error('[AI Tool] checkPromoCode error:', err.message)
    return JSON.stringify({ valid: false, error: 'Lỗi khi kiểm tra mã giảm giá.' })
  }
}

function normalizeSubtotal(subtotal) {
  const value = Number(subtotal)
  return Number.isFinite(value) && value > 0 ? value : null
}

function isPromoExpired(promo, now = new Date()) {
  return !!(promo?.expiresAt && new Date(promo.expiresAt) < now)
}

function isPromoExhausted(promo) {
  return promo?.usageLimit != null && Number(promo.usedCount || 0) >= Number(promo.usageLimit)
}

function hasUserUsedPromo(promo, userId) {
  if (!promo || !userId || !Array.isArray(promo.usedBy)) return false
  return promo.usedBy.some(item => String(item) === String(userId))
}

function calculatePromoDiscount(promo, subtotal) {
  if (!promo || !Number.isFinite(Number(subtotal))) return 0

  if (promo.discountType === 'percent') {
    let discount = Math.floor((Number(subtotal) * Number(promo.discountValue || 0)) / 100)
    if (promo.maxDiscount) {
      discount = Math.min(discount, Number(promo.maxDiscount))
    }
    return discount
  }

  return Number(promo.discountValue || 0)
}

function buildPromoPayload(promo, { subtotal = null } = {}) {
  const payload = {
    code: promo.code,
    discountType: promo.discountType,
    discountValue: promo.discountValue,
    description: promo.discountType === 'percent'
      ? `Giảm ${promo.discountValue}%${promo.maxDiscount ? `, tối đa ${formatPrice(promo.maxDiscount)}` : ''}`
      : `Giảm ${formatPrice(promo.discountValue)}`,
    minOrder: promo.minOrder || 0,
    minOrderFormatted: formatPrice(promo.minOrder || 0),
    maxDiscount: promo.maxDiscount || null,
    maxDiscountFormatted: promo.maxDiscount ? formatPrice(promo.maxDiscount) : null,
    usageRemaining: promo.usageLimit != null
      ? Math.max(0, Number(promo.usageLimit) - Number(promo.usedCount || 0))
      : null,
    expiresAt: promo.expiresAt || null,
    expiresAtFormatted: promo.expiresAt ? formatDate(promo.expiresAt) : null,
    isPrivate: !!promo.userId
  }

  if (subtotal !== null) {
    payload.eligible = subtotal >= Number(promo.minOrder || 0)
    payload.estimatedDiscount = payload.eligible ? calculatePromoDiscount(promo, subtotal) : 0
    payload.estimatedDiscountFormatted = formatPrice(payload.estimatedDiscount)
  }

  return payload
}

module.exports = {
  checkPromoCode,
  normalizeSubtotal,
  isPromoExpired,
  isPromoExhausted,
  hasUserUsedPromo,
  calculatePromoDiscount,
  buildPromoPayload
}
