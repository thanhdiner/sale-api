// controllers/admin/bankInfo.controller.js
const BankInfo = require('../../models/bankInfo.model')
const removeAccents = require('remove-accents')
const logger = require('../../../../config/logger')

const toBool = v => v === true || v === 'true' || v === 1 || v === '1'

// # GET /api/v1/bank-infos
module.exports.getAllBankInfos = async (req, res) => {
  try {
    const { page = 1, limit = 20, keyword = '', isActive = '' } = req.query
    const pageNum = parseInt(page, 10) || 1
    const pageLimit = parseInt(limit, 10) || 20

    const query = { isDeleted: false }

    if (isActive !== '') {
      query.isActive = isActive === 'true'
    }

    if (keyword) {
      const kw = String(keyword).trim()
      const kwNo = removeAccents(kw)
      const isObjectId = kw.length === 24 && /^[a-fA-F0-9]{24}$/.test(kw)

      if (kw === kwNo) {
        query.$or = [
          { bankName: { $regex: kw, $options: 'i' } },
          { accountNumber: { $regex: kw, $options: 'i' } },
          { accountHolder: { $regex: kw, $options: 'i' } },
          ...(isObjectId ? [{ _id: kw }] : [])
        ]
      } else {
        query.$or = [
          { bankName: { $regex: kw, $options: 'i' } },
          { accountNumber: { $regex: kw, $options: 'i' } },
          { accountHolder: { $regex: kw, $options: 'i' } },
          ...(isObjectId ? [{ _id: kw }] : [])
        ]
      }
    }

    const total = await BankInfo.countDocuments(query)
    const bankInfos = await BankInfo.find(query)
      .sort({ isActive: -1, updatedAt: -1 })
      .skip((pageNum - 1) * pageLimit)
      .limit(pageLimit)

    res.json({ success: true, bankInfos, total })
  } catch (err) {
    logger.error('[Admin] getAllBankInfos error:', err)
    res.status(500).json({ error: 'Lỗi lấy danh sách bank info' })
  }
}

// # GET /api/v1/bank-infos/active
module.exports.getActiveBankInfo = async (_req, res) => {
  try {
    const active = await BankInfo.findOne({ isActive: true, isDeleted: false }).sort({ updatedAt: -1 })
    if (!active) return res.status(404).json({ error: 'Không có bank info đang dùng' })
    res.json({ success: true, bankInfo: active })
  } catch (err) {
    res.status(500).json({ error: 'Lỗi lấy bank info đang dùng' })
  }
}

// # POST /api/v1/bank-infos
module.exports.createBankInfo = async (req, res) => {
  try {
    const { bankName, accountNumber, accountHolder, noteTemplate, qrCode, isActive } = req.body

    if (isActive === true) {
      await BankInfo.updateMany({}, { $set: { isActive: false } })
    }

    const doc = await BankInfo.create({
      bankName,
      accountNumber,
      accountHolder,
      noteTemplate,
      isActive: !!isActive,
      qrCode,
      isDeleted: false,
      createdBy: req.user?.id ? { account_id: String(req.user.id), createAt: new Date() } : undefined
    })

    res.status(201).json({ success: true, bankInfo: doc })
  } catch (err) {
    res.status(400).json({ error: 'Lỗi tạo bank info', detail: err.message })
  }
}

// # PATCH /api/v1/bank-infos/:id
module.exports.updateBankInfo = async (req, res) => {
  try {
    const { id } = req.params
    const existing = await BankInfo.findOne({ _id: id, isDeleted: false })
    if (!existing) {
      return res.status(404).json({ error: 'Không tìm thấy bank info' })
    }

    const { bankName, accountNumber, accountHolder, noteTemplate, isActive, qrCode } = req.body

    if (isActive === true) {
      await BankInfo.updateMany({ _id: { $ne: id } }, { $set: { isActive: false } })
      existing.isActive = true
    } else if (typeof isActive === 'boolean') {
      existing.isActive = isActive
    }

    if (typeof bankName === 'string') existing.bankName = bankName
    if (typeof accountNumber === 'string') existing.accountNumber = accountNumber
    if (typeof accountHolder === 'string') existing.accountHolder = accountHolder
    if (typeof noteTemplate === 'string') existing.noteTemplate = noteTemplate
    if (typeof qrCode === 'string') existing.qrCode = qrCode

    await existing.save()
    res.json({ success: true, bankInfo: existing })
  } catch (err) {
    res.status(400).json({ error: 'Lỗi cập nhật bank info', detail: err.message })
  }
}

// # PATCH /api/v1/bank-infos/:id/activate
module.exports.activateBankInfo = async (req, res) => {
  try {
    const { id } = req.params
    const active = typeof req.body.active !== 'undefined' ? req.body.active : req.query.active
    const wantActive = toBool(active)

    const doc = await BankInfo.findOne({ _id: id, isDeleted: false })
    if (!doc) return res.status(404).json({ error: 'Không tìm thấy bank info' })

    if (wantActive) {
      await BankInfo.updateMany({ _id: { $ne: id } }, { $set: { isActive: false } })
      doc.isActive = true
      await doc.save()
      return res.json({ success: true, bankInfo: doc })
    }

    // muốn tắt
    const otherActive = await BankInfo.countDocuments({
      _id: { $ne: id },
      isActive: true,
      isDeleted: false
    })
    if (otherActive === 0) {
      return res.status(400).json({ error: 'Cần ít nhất 1 bản ghi đang dùng' })
    }

    doc.isActive = false
    await doc.save()
    res.json({ success: true, bankInfo: doc })
  } catch (err) {
    res.status(500).json({ error: 'Lỗi kích hoạt bank info' })
  }
}

// # PATCH /api/v1/bank-infos/:id/delete
module.exports.deleteBankInfo = async (req, res) => {
  try {
    const { id } = req.params
    const hard = req.query.hard === '1'

    const doc = await BankInfo.findById(id)
    if (!doc) return res.status(404).json({ error: 'Không tìm thấy bank info' })

    if (doc.isActive) {
      const otherActive = await BankInfo.countDocuments({
        _id: { $ne: id },
        isActive: true,
        isDeleted: false
      })
      if (otherActive === 0) {
        return res.status(400).json({ error: 'Cần ít nhất 1 bản ghi đang dùng' })
      }
    }

    if (hard) {
      await BankInfo.findByIdAndDelete(id)
      return res.json({ success: true, hardDeleted: true })
    }

    doc.isDeleted = true
    doc.isActive = false
    await doc.save()

    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: 'Lỗi xóa bank info' })
  }
}
