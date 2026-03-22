const PromoCode = require('../../models/promoCode.model')
const logger = require('../../../../config/logger')

//# GET /api/v1/admin/promo-codes
module.exports.listPromoCodes = async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '' } = req.query
    const query = search ? { code: { $regex: search, $options: 'i' } } : {}
    const promoCodes = await PromoCode.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
    const total = await PromoCode.countDocuments(query)
    res.json({ promoCodes, total })
  } catch (err) {
    res.status(500).json({ error: 'Lỗi lấy danh sách mã giảm giá' })
  }
}

//# POST /api/v1/admin/promo-codes/create
module.exports.createPromoCode = async (req, res) => {
  try {
    const data = req.body
    // Optional: toUpperCase mã
    data.code = data.code.trim().toUpperCase()
    const newPromo = await PromoCode.create(data)
    res.json({ success: true, promoCode: newPromo })
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
}

//# GET /api/v1/admin/promo-codes/:id
module.exports.getPromoCode = async (req, res) => {
  try {
    const promo = await PromoCode.findById(req.params.id)
    if (!promo) return res.status(404).json({ error: 'Không tìm thấy mã' })
    res.json({ promoCode: promo })
  } catch (err) {
    res.status(400).json({ error: 'Lỗi lấy chi tiết' })
  }
}

//# PATCH /api/v1/admin/promo-codes/update/:id
module.exports.updatePromoCode = async (req, res) => {
  try {
    const data = req.body
    if (data.code) data.code = data.code.trim().toUpperCase()
    const promo = await PromoCode.findByIdAndUpdate(req.params.id, data, { new: true })
    res.json({ success: true, promoCode: promo })
  } catch (err) {
    logger.error('[Admin] UPDATE PROMO ERROR:', err)
    res.status(400).json({ error: err.message })
  }
}

//# DELETE /api/v1/admin/promo-codes/delete/:id
module.exports.deletePromoCode = async (req, res) => {
  try {
    await PromoCode.findByIdAndDelete(req.params.id)
    res.json({ success: true })
  } catch (err) {
    res.status(400).json({ error: 'Lỗi xoá mã' })
  }
}
