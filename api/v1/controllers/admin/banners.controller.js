const Banner = require('../../models/banner.model')
const mongoose = require('mongoose')
const { deleteImageFromCloudinary } = require('../../utils/cloudinaryUtils')

//# GET /api/v1/admin/banners
module.exports.index = async (req, res) => {
  try {
    const banners = await Banner.find({}).sort({ order: 1 })
    res.status(200).json({
      message: 'Banners fetched successfully',
      data: banners
    })
  } catch (err) {
    console.error('Error fetching banners:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

//# POST /api/v1/admin/banners
module.exports.create = async (req, res) => {
  try {
    const { title, link, order, isActive } = req.body

    if (!title) {
      return res.status(400).json({ message: 'Title is required' })
    }

    // Lấy url ảnh từ req.body.img (được middleware uploadCloud.upload gán)
    const imgUrl = req.body.img
    if (!imgUrl) {
      return res.status(400).json({ message: 'Image is required' })
    }

    const banner = new Banner({
      title,
      img: imgUrl,
      link: link || '',
      order: order ? Number(order) : 0,
      isActive: isActive !== undefined ? Boolean(isActive) : true,
      createdBy: req.user?.userId || null
    })

    const savedBanner = await banner.save()

    res.status(201).json({
      message: 'Banner created successfully',
      data: savedBanner
    })
  } catch (err) {
    console.error('Error creating banner:', err)
    res.status(500).json({ error: 'Failed to create banner' })
  }
}

//# PATCH /api/v1/admin/banners/:id
module.exports.edit = async (req, res) => {
  try {
    const { id } = req.params

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid banner ID' })
    }

    const allowedFields = ['title', 'link', 'order', 'isActive']
    const updateData = {}

    allowedFields.forEach(field => {
      if (field in req.body) {
        updateData[field] = req.body[field]
      }
    })

    const imgUrl = req.file?.path || req.file?.location
    if (imgUrl) {
      updateData.img = imgUrl
    }

    updateData.updatedAt = new Date()
    updateData.updatedBy = req.user?.userId || null

    const updatedBanner = await Banner.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true
    })

    if (!updatedBanner) {
      return res.status(404).json({ message: 'Banner not found' })
    }

    res.status(200).json({
      message: 'Banner updated successfully',
      data: updatedBanner
    })
  } catch (err) {
    console.error('Error updating banner:', err)
    res.status(500).json({ error: 'Failed to update banner' })
  }
}

//# DELETE /api/v1/admin/banners/:id
module.exports.delete = async (req, res) => {
  try {
    const { id } = req.params

    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid banner ID' })

    const banner = await Banner.findById(id)
    if (!banner) return res.status(404).json({ message: 'Banner not found' })

    if (banner.img) await deleteImageFromCloudinary(banner.img)

    await Banner.findByIdAndDelete(id)

    res.status(200).json({
      message: 'Banner deleted successfully'
    })
  } catch (err) {
    console.error('Error deleting banner:', err)
    res.status(500).json({ error: 'Failed to delete banner' })
  }
}
