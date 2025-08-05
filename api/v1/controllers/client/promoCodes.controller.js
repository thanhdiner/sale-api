const PromoCode = require('../../models/promoCode.model')

//# GET /api/v1/promo-codes
module.exports.getPromoCodes = async (req, res) => {
  try {
    const promoCodes = await PromoCode.find({ isActive: true, expiresAt: { $gte: new Date() } }).sort({ createdAt: -1 })

    res.json({ success: true, promoCodes })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' })
  }
}

//# POST /api/v1/promo-codes/validate
module.exports.validatePromoCode = async (req, res) => {
  try {
    const { code, subtotal, userId } = req.body
    if (!code) return res.json({ valid: false, message: 'Thiếu mã giảm giá' })

    const promo = await PromoCode.findOne({ code: code.trim().toUpperCase(), isActive: true })
    if (!promo) return res.json({ valid: false, message: 'Mã không tồn tại hoặc đã hết hạn' })
    if (promo.expiresAt && promo.expiresAt < new Date()) return res.json({ valid: false, message: 'Mã đã hết hạn' })
    if (promo.usageLimit && promo.usedCount >= promo.usageLimit) return res.json({ valid: false, message: 'Mã đã hết lượt dùng' })
    if (promo.minOrder && subtotal < promo.minOrder) return res.json({ valid: false, message: `Đơn tối thiểu ${promo.minOrder}đ` })
    if (promo.usedBy && userId && promo.usedBy.includes(userId)) return res.json({ valid: false, message: 'Bạn đã dùng mã này rồi' })

    let discount = 0
    if (promo.discountType === 'percent') {
      discount = Math.floor((subtotal * promo.discountValue) / 100)
      if (promo.maxDiscount) discount = Math.min(discount, promo.maxDiscount)
    } else {
      discount = promo.discountValue
    }

    res.json({
      valid: true,
      discount,
      discountType: promo.discountType,
      message: `Áp dụng mã ${promo.code} thành công`,
      promoInfo: promo
    })
  } catch (err) {
    res.status(500).json({ valid: false, message: 'Lỗi máy chủ' })
  }
}
