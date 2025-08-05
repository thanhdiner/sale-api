const Widget = require('../../models/widgets.model')
const mongoose = require('mongoose')
const { deleteImageFromCloudinary } = require('../../utils/cloudinaryUtils')

//# GET /api/v1/admin/widgets
module.exports.index = async (req, res) => {
  try {
    const { title, isActive, sortField, sortOrder } = req.query

    const filter = {}
    if (title) filter.title = { $regex: title, $options: 'i' }
    if (typeof isActive !== 'undefined') filter.isActive = isActive === 'true'

    const sort = {}
    if (sortField && sortOrder) sort[sortField] = sortOrder === 'descend' ? -1 : 1
    else sort.order = 1

    const widgets = await Widget.find(filter).sort(sort)

    res.status(200).json({
      message: 'Widgets fetched successfully',
      data: widgets
    })
  } catch (err) {
    console.error('Error fetching widgets:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

//# POST /api/v1/admin/widgets
module.exports.create = async (req, res) => {
  try {
    const { title, iconUrl, link, order, isActive } = req.body

    if (!title || !iconUrl) return res.status(400).json({ message: 'Title and iconUrl are required' })

    let orderNumber = 0

    if (order !== undefined) {
      orderNumber = Number(order)
      if (isNaN(orderNumber)) orderNumber = 0
    } else {
      const lastWidget = await Widget.findOne().sort({ order: -1 }).limit(1)
      orderNumber = lastWidget ? lastWidget.order + 1 : 0
    }

    const widget = new Widget({
      title,
      iconUrl,
      link: link || '',
      order: orderNumber,
      isActive: typeof isActive === 'boolean' ? isActive : true,
      createdBy: req.user?.userId || null
    })

    const savedWidget = await widget.save()

    res.status(201).json({
      message: 'Widget created successfully',
      data: savedWidget
    })
  } catch (err) {
    console.error('Error creating widget:', err)
    res.status(500).json({ error: 'Failed to create widget' })
  }
}

//# PATCH /api/v1/admin/widgets/:id
module.exports.edit = async (req, res) => {
  try {
    const { id } = req.params

    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid widget ID' })

    const allowedFields = ['title', 'iconUrl', 'link', 'order', 'isActive']
    const updateData = {}

    allowedFields.forEach(field => {
      if (field in req.body) updateData[field] = req.body[field]
    })

    updateData.updatedAt = new Date()
    updateData.updatedBy = req.user?.userId || null

    const updatedWidget = await Widget.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true
    })

    if (!updatedWidget) return res.status(404).json({ message: 'Widget not found' })

    res.status(200).json({
      message: 'Widget updated successfully',
      data: updatedWidget
    })
  } catch (err) {
    console.error('Error updating widget:', err)
    res.status(500).json({ error: 'Failed to update widget' })
  }
}

//# DELETE /api/v1/admin/widgets/:id
module.exports.delete = async (req, res) => {
  try {
    const { id } = req.params

    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid widget ID' })

    const widget = await Widget.findById(id)
    if (!widget) return res.status(404).json({ message: 'Widget not found' })

    if (widget.iconUrl) await deleteImageFromCloudinary(widget.iconUrl)

    await Widget.findByIdAndDelete(id)

    res.status(200).json({
      message: 'Widget deleted successfully'
    })
  } catch (err) {
    console.error('Error deleting widget:', err)
    res.status(500).json({ error: 'Failed to delete widget' })
  }
}
