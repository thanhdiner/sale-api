const Role = require('../../models/roles.model')
const logger = require('../../../../config/logger')

//# GET /api/v1/admin/roles
module.exports.index = async (req, res) => {
  try {
    const find = { deleted: false }
    const roles = await Role.find(find)
    res.json({ data: roles })
  } catch (err) {
    logger.error('[Admin] Error getting roles:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

//# POST /api/v1/admin/roles/create
module.exports.create = async (req, res) => {
  try {
    const { label, description, permissions = [], isActive } = req.body
    if (!label) return res.status(400).json({ error: 'Role name (label) is required' })
    const exists = await Role.findOne({ label, deleted: false })
    if (exists) return res.status(400).json({ message: 'Role name (label) already exists' })

    const roles = new Role({
      label,
      description,
      permissions,
      isActive
    })
    await roles.save()

    res.status(201).json({ message: 'Created', data: roles })
  } catch (err) {
    logger.error('[Admin] Error creating role:', err)
    return res.status(500).json({ error: 'Internal server error', message: 'Created unsuccessful' })
  }
}

//# PATCH /api/v1/admin/roles/edit/:id
module.exports.edit = async (req, res) => {
  try {
    const { id } = req.params
    const { label, description, permissions, isActive } = req.body

    if (!label) return res.status(400).json({ error: 'Role name (label) is required' })

    const exists = await Role.findOne({ label, _id: { $ne: id }, deleted: false })
    if (exists) return res.status(400).json({ error: 'Role name (label) already exists' })

    const updated = await Role.findByIdAndUpdate(id, { label, description, permissions, isActive }, { new: true })
    if (!updated) return res.status(404).json({ error: 'Role group not found' })

    res.status(200).json({ message: 'Updated', data: updated })
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error', message: 'Updated unsuccessful' })
  }
}

//# DELETE /api/v1/admin/roles/delete/:id
module.exports.delete = async (req, res) => {
  try {
    const { id } = req.params

    //@ sau làm phần check nếu còn liên kết vs user thì ko cho xóa ^^

    const deleted = await Role.findByIdAndUpdate(id, { deleted: true }, { new: true })
    if (!deleted) return res.status(404).json({ error: 'Role not found' })

    res.status(200).json({ message: 'Role deleted!', data: deleted })
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' })
  }
}

//# PATCH /api/v1/admin/roles/toggle-active/:id
module.exports.toggleActive = async (req, res) => {
  try {
    const { id } = req.params
    const role = await Role.findById(id)
    if (!role) return res.status(404).json({ error: 'Role not found' })

    role.isActive = !role.isActive
    await role.save()

    res.status(200).json({ message: 'Toggled status', data: role })
  } catch (err) {
    res.status(500).json({ error: 'Internal server error', detail: err.message })
  }
}
