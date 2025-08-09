const BankInfo = require('../../models/bankInfo.model')

// # GET /api/v1/client/bank-info/active
module.exports.getActiveBankInfo = async (_req, res) => {
  try {
    const active = await BankInfo.findOne({ isActive: true, isDeleted: false }).sort({ updatedAt: -1 })
    if (!active) return res.status(404).json({ error: 'Không có bank info đang dùng' })
    res.json({ success: true, bankInfo: active })
  } catch (err) {
    res.status(500).json({ error: 'Lỗi lấy bank info đang dùng' })
  }
}
