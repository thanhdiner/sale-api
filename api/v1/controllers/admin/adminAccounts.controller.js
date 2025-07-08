const AdminAccount = require('../../models/adminAccount.model')
const bcrypt = require('bcrypt')

//# GET /api/v1/admin/accounts
module.exports.index = async (req, res) => {
  try {
    const find = { deleted: false }
    const accounts = await AdminAccount.find(find).select('-passwordHash')
    res.json({ data: accounts })
  } catch (err) {
    console.error('Error getting accounts:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

//# POST /api/v1/admin/accounts/create
module.exports.create = async (req, res) => {
  try {
    const { username, email, password, fullName, role_id, status, avatarUrl } = req.body
    const exist = await AdminAccount.findOne({
      $or: [{ username }, { email }]
    })
    if (exist) return res.status(400).json({ message: 'Username hoặc email đã tồn tại.' })
    if (!username) return res.status(400).json({ message: 'Username là bắt buộc!' })
    if (/\s/.test(username)) return res.status(400).json({ message: 'Username không được chứa khoảng trắng!' })
    if (!/^[a-zA-Z0-9_]+$/.test(username)) return res.status(400).json({ message: 'Username chỉ được chứa chữ cái, số và dấu _' })
    if (!email) return res.status(400).json({ message: 'Email là bắt buộc!' })
    if (!password) return res.status(400).json({ message: 'Mật khẩu là bắt buộc!' })
    if (!fullName) return res.status(400).json({ message: 'Tên đầy đủ là bắt buộc!' })
    const passwordHash = await bcrypt.hash(password, 10)

    const newAccount = new AdminAccount({
      username,
      email,
      fullName,
      role_id,
      status,
      avatarUrl,
      passwordHash
    })
    await newAccount.save()
    const { passwordHash: _, ...accountData } = newAccount.toObject()

    res.status(201).json({ data: accountData })
  } catch (err) {
    console.error('Error creating account:', err)
    return res.status(500).json({ error: 'Internal server error', message: 'Created unsuccessful', status: 500 })
  }
}

//# PATCH /api/v1/admin/accounts/edit/:id
module.exports.edit = async (req, res) => {
  try {
    const { id } = req.params
    const { email, fullName, role_id, status, avatarUrl, newPassword } = req.body

    if (!email) return res.status(400).json({ message: 'Email là bắt buộc!' })

    const exist = await AdminAccount.findOne({ _id: { $ne: id }, email })
    if (exist) return res.status(400).json({ message: 'Email đã tồn tại.' })

    const updateData = { email, fullName, role_id, status, avatarUrl }

    if (newPassword && newPassword.length >= 6) {
      const passwordHash = await bcrypt.hash(newPassword, 10)
      updateData.passwordHash = passwordHash
    }

    const updated = await AdminAccount.findByIdAndUpdate(id, updateData, { new: true })
    if (!updated) return res.status(404).json({ error: 'Account not found' })

    const { passwordHash: _, ...updatedData } = updated.toObject()

    res.status(200).json({ message: 'Updated', data: updatedData })
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error', message: 'Updated unsuccessful', status: 500 })
  }
}

//# PATCH /api/v1/admin/permission-groups/delete/:id
module.exports.delete = async (req, res) => {
  try {
    const { id } = req.params

    const account = await AdminAccount.findById(id)
    if (!account) return res.status(404).json({ message: 'Account not found' })

    if (account.role_id === 'superadmin' || account.username === 'superadmin')
      return res.status(403).json({ message: 'Không thể xoá tài khoản Super Admin!' })

    await AdminAccount.findByIdAndUpdate(id, { deleted: true }, { new: true })

    res.status(200).json({ message: 'Account deleted successfully' })
  } catch (err) {
    res.status(500).json({ error: 'Internal server error', status: 500 })
  }
}

//# PATCH /api/v1/admin/accounts/change-status/:id
module.exports.changeStatus = async (req, res) => {
  try {
    const { id } = req.params
    const { status } = req.body

    if (!['active', 'inactive', 'banned'].includes(status)) return res.status(400).json({ message: 'Trạng thái không hợp lệ!' })
    const account = await AdminAccount.findById(id)
    if (!account) return res.status(404).json({ message: 'Account not found' })
    if (account.role_id === 'superadmin' || account.username === 'superadmin')
      return res.status(403).json({ message: 'Không thể đổi trạng thái Super Admin!' })
    const updated = await AdminAccount.findByIdAndUpdate(id, { status }, { new: true })
    const { passwordHash: _, ...updatedData } = updated.toObject()
    res.status(200).json({ message: 'Cập nhật trạng thái thành công!', data: updatedData })
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error', message: 'Updated unsuccessful', status: 500 })
  }
}
