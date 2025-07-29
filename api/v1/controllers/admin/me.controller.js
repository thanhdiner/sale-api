const adminAccountModel = require('../../models/adminAccount.model')

//# GET /api/v1/admin/me
module.exports.index = async (req, res) => {
  try {
    const admin = await adminAccountModel.findById(req.user.userId).select('-passwordHash -__v').populate('role_id', 'label permissions')
    if (!admin) return res.status(404).json({ error: 'Admin not found' })
    res.json(admin)
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
}
