const BankInfo = require('../../models/bankInfo.model')
const cache = require('../../../../config/redis')

// # GET /api/v1/client/bank-info/active
module.exports.getActiveBankInfo = async (_req, res) => {
  try {
    const result = await cache.getOrSet('bankinfo:active', async () => {
      const active = await BankInfo.findOne({ isActive: true, isDeleted: false }).sort({ updatedAt: -1 })
      if (!active) return null
      return { success: true, bankInfo: active }
    }, 300) // 5 phút

    if (!result) return res.status(404).json({ error: 'Không có bank info đang dùng' })
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: 'Lỗi lấy bank info đang dùng' })
  }
}
