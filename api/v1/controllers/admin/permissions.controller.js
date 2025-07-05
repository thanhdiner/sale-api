const Permission = require('../../models/permission.model')

//# GET /api/v1/admin/permissions
module.exports.index = async (req, res) => {
  try {
    const { group } = req.query
    const query = { deleted: false }
    if (group) query.group = group
    const permissions = await Permission.find(query)
    res.json({ data: permissions })
  } catch (err) {
    console.error('Error getting permissions:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

//# POST /api/v1/admin/permissions/create
module.exports.create = async (req, res) => {
  try {
    const { name, title, description, group } = req.body
    if (!name || !title || !group) return res.status(400).json({ error: 'Name, title and group are required' })
    if (!/^[a-z0-9_]+$/.test(name)) return res.status(400).json({ error: 'Only a-z, 0-9, and _' })
    const existingPermission = await Permission.findOne({ name, deleted: false })
    if (existingPermission) return res.status(400).json({ error: 'Permission with this name already exists' })

    const permission = new Permission({
      name,
      title,
      description,
      group
    })
    await permission.save()

    res.status(201).json({ message: 'Created', data: permission })
  } catch (err) {
    console.error('Error creating permission:', err)
    return res.status(500).json({ error: 'Internal server error', message: 'Created unsuccessful', status: 500 })
  }
}

//# PATCH /api/v1/admin/permissions/edit/:id
module.exports.edit = async (req, res) => {
  try {
    const { id } = req.params
    const { name, title, description, group } = req.body

    if (!name || !title || !group) return res.status(400).json({ error: 'Name, title and group are required' })
    if (!/^[a-z0-9_]+$/.test(name)) return res.status(400).json({ error: 'Only a-z, 0-9, and _' })
    const exist = await Permission.findOne({ name, _id: { $ne: id }, deleted: false })
    if (exist) return res.status(409).json({ error: 'Permission with this name already exists' })

    const updated = await Permission.findByIdAndUpdate(id, { name, title, description, group }, { new: true })
    if (!updated) return res.status(404).json({ error: 'Permission not found' })

    res.status(200).json({ message: 'Updated', data: updated })
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error', message: 'Updated unsuccessful', status: 500 })
  }
}

//# DELETE /api/v1/admin/permissions/delete/:id
module.exports.delete = async (req, res) => {
  try {
    const { id } = req.params
    const deleted = await Permission.findByIdAndUpdate(id, { deleted: true }, { new: true })
    if (!deleted) return res.status(404).json({ error: 'Permission not found' })

    res.status(200).json({ message: 'Deleted', data: deleted })
  } catch (err) {
    console.error('Error deleting permission:', err)
    res.status(500).json({ error: 'Internal server error', status: 500 })
  }
}
