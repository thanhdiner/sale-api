const PermissionGroups = require('../../models/permission-group.model')
const Permissions = require('../../models/permission.model')

//# GET /api/v1/admin/permission-groups
module.exports.index = async (req, res) => {
  try {
    const find = { deleted: false }
    const permissionGroups = await PermissionGroups.find(find)
    res.json({ data: permissionGroups })
  } catch (err) {
    console.error('Error getting permission groups:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

//# POST /api/v1/admin/permission-groups/create
module.exports.create = async (req, res) => {
  try {
    const { label, value, description, isActive } = req.body
    if (!label || !value) return res.status(400).json({ error: 'Label, value are required' })
    const exists = await PermissionGroups.findOne({ value, deleted: false })
    if (exists) return res.status(400).json({ message: 'Group value already exists' })
    if (!/^[a-z0-9_]+$/.test(value)) return res.status(400).json({ error: 'Only a-z, 0-9, and _' })

    const permissionGroups = new PermissionGroups({
      label,
      value,
      description,
      isActive
    })
    await permissionGroups.save()

    res.status(201).json({ message: 'Created', data: permissionGroups })
  } catch (err) {
    console.error('Error creating permission group:', err)
    return res.status(500).json({ error: 'Internal server error', message: 'Created unsuccessful', status: 500 })
  }
}

//# PATCH /api/v1/admin/permissions/edit/:id
module.exports.edit = async (req, res) => {
  try {
    const { id } = req.params
    const { label, description, isActive } = req.body

    if (!label) return res.status(400).json({ error: 'Label is required' })

    const updated = await PermissionGroups.findByIdAndUpdate(id, { label, description, isActive }, { new: true })
    if (!updated) return res.status(404).json({ error: 'Permission group not found' })

    res.status(200).json({ message: 'Updated', data: updated })
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error', message: 'Updated unsuccessful', status: 500 })
  }
}

//# PATCH /api/v1/admin/permission-groups/delete/:id
module.exports.delete = async (req, res) => {
  try {
    const { id } = req.params

    const group = await PermissionGroups.findById(id)
    if (!group || group.deleted) return res.status(404).json({ message: 'Permission group not found' })

    const permissionCount = await Permissions.countDocuments({ group: group.value, deleted: false })
    if (permissionCount > 0) {
      return res.status(400).json({
        message: `Không thể xoá nhóm quyền vì còn ${permissionCount} permission liên kết!`
      })
    }

    group.deleted = true
    await group.save()

    res.status(200).json({ message: 'Permission group deleted successfully' })
  } catch (err) {
    res.status(500).json({ error: 'Internal server error', status: 500 })
  }
}

//# PATCH /api/v1/admin/permissions/toggle-active/:id
module.exports.toggleActive = async (req, res) => {
  try {
    const { id } = req.params
    const { isActive } = req.body

    const isBoolean = 'isActive is required and must be boolean'
    const notfound = 'Permission group not found'
    if (typeof isActive !== 'boolean') return res.status(400).json({ error: isBoolean, message: isBoolean })

    const updated = await PermissionGroups.findByIdAndUpdate(id, { isActive }, { new: true })
    if (!updated) return res.status(404).json({ error: notfound, message: notfound })

    res.status(200).json({ message: 'Updated', data: updated })
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error', message: 'Updated unsuccessful', status: 500 })
  }
}
