const promoCodeRepository = require('../../repositories/promoCode.repository')

async function getPromoCodes() {
  const promoCodes = await promoCodeRepository.findAll({
    isActive: true,
    expiresAt: { $gte: new Date() }
  }, {
    sort: { createdAt: -1 }
  })

  return { success: true, promoCodes }
}

async function validatePromoCode({ code, subtotal, userId }) {
  if (!code) {
    return { valid: false, message: 'Thiếu mã giảm giá' }
  }

  const promo = await promoCodeRepository.findOne({
    code: code.trim().toUpperCase(),
    isActive: true
  })

  if (!promo) return { valid: false, message: 'Mã không tồn tại hoặc đã hết hạn' }
  if (promo.expiresAt && promo.expiresAt < new Date()) return { valid: false, message: 'Mã đã hết hạn' }
  if (promo.usageLimit && promo.usedCount >= promo.usageLimit) return { valid: false, message: 'Mã đã hết lượt dùng' }
  if (promo.minOrder && subtotal < promo.minOrder) return { valid: false, message: `Đơn tối thiểu ${promo.minOrder}đ` }
  if (promo.usedBy && userId && promo.usedBy.includes(userId)) return { valid: false, message: 'Bạn đã dùng mã này rồi' }

  let discount = 0
  if (promo.discountType === 'percent') {
    discount = Math.floor((subtotal * promo.discountValue) / 100)
    if (promo.maxDiscount) discount = Math.min(discount, promo.maxDiscount)
  } else {
    discount = promo.discountValue
  }

  return {
    valid: true,
    discount,
    discountType: promo.discountType,
    message: `Áp dụng mã ${promo.code} thành công`,
    promoInfo: promo
  }
}

module.exports = {
  getPromoCodes,
  validatePromoCode
}
