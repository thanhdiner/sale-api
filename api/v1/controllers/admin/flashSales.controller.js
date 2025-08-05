const FlashSale = require('../../models/flashSale.model')

//# GET /api/v1/admin/flashsales
module.exports.index = async (req, res) => {
  try {
    const { status, name, page = 1, limit = 20 } = req.query
    const filter = {}
    if (status && status !== 'all') filter.status = status
    if (name) filter.name = { $regex: name, $options: 'i' }

    const total = await FlashSale.countDocuments(filter)
    const flashSales = await FlashSale.find(filter)
      .populate('products', 'name')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))

    const now = new Date()
    const flashSalesWithStatus = flashSales.map(sale => {
      let status = sale.status
      if (now < sale.startAt) status = 'scheduled'
      else if (now >= sale.startAt && now <= sale.endAt && sale.soldQuantity < sale.maxQuantity) status = 'active'
      else status = 'completed'
      return { ...sale.toObject(), status }
    })

    res.json({ total, flashSales: flashSalesWithStatus })
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err })
  }
}

//# GET /api/v1/admin/flashsales/:id
module.exports.detail = async (req, res) => {
  try {
    const flashSale = await FlashSale.findById(req.params.id).populate('products', 'name price')
    if (!flashSale) return res.status(404).json({ message: 'Không tìm thấy flash sale' })
    const now = new Date()
    let status = flashSale.status
    if (now < flashSale.startAt) status = 'scheduled'
    else if (now >= flashSale.startAt && now <= flashSale.endAt && flashSale.soldQuantity < flashSale.maxQuantity) status = 'active'
    else status = 'completed'
    res.json({ flashSale: { ...flashSale.toObject(), status } })
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err })
  }
}

//# POST /api/v1/admin/flashsales/create
module.exports.create = async (req, res) => {
  try {
    const { name, startAt, endAt, discountPercent, maxQuantity, products } = req.body
    if (!name || !startAt || !endAt || !discountPercent || !maxQuantity || !products || !products.length) {
      return res.status(400).json({ message: 'Thiếu thông tin bắt buộc' })
    }
    const newFlashSale = await FlashSale.create({
      name,
      startAt,
      endAt,
      discountPercent,
      maxQuantity,
      products,
      soldQuantity: 0,
      status: 'scheduled',
      revenue: 0
    })
    res.status(201).json({ message: 'Tạo flash sale thành công', flashSale: newFlashSale })
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err })
  }
}

//# PATCH /api/v1/admin/flashsales/edit/:id
module.exports.edit = async (req, res) => {
  try {
    const { name, startAt, endAt, discountPercent, maxQuantity, products } = req.body
    const flashSale = await FlashSale.findById(req.params.id)
    if (!flashSale) return res.status(404).json({ message: 'Không tìm thấy flash sale' })

    if (name) flashSale.name = name
    if (startAt) flashSale.startAt = startAt
    if (endAt) flashSale.endAt = endAt
    if (discountPercent) flashSale.discountPercent = discountPercent
    if (maxQuantity) flashSale.maxQuantity = maxQuantity
    if (products) flashSale.products = products

    await flashSale.save()
    res.json({ message: 'Cập nhật thành công', flashSale })
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err })
  }
}

//# DELETE /api/v1/admin/flashsales/delete/:id
module.exports.delete = async (req, res) => {
  try {
    const result = await FlashSale.findByIdAndDelete(req.params.id)
    if (!result) return res.status(404).json({ message: 'Không tìm thấy flash sale' })
    res.json({ message: 'Đã xóa flash sale thành công' })
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err })
  }
}

//# PATCH /api/v1/admin/flashsales/delete-many
module.exports.deleteMany = async (req, res) => {
  try {
    const { ids } = req.body
    if (!Array.isArray(ids) || !ids.length) {
      return res.status(400).json({ message: 'Cần truyền mảng ids' })
    }
    const result = await FlashSale.deleteMany({ _id: { $in: ids } })
    res.json({ message: `Đã xóa ${result.deletedCount} flash sale` })
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err })
  }
}

//# PATCH /api/v1/admin/flashsales/changeStatus/:id
module.exports.changeStatus = async (req, res) => {
  try {
    const { status } = req.body
    const flashSale = await FlashSale.findById(req.params.id)
    if (!flashSale) return res.status(404).json({ message: 'Không tìm thấy flash sale' })
    flashSale.status = status
    await flashSale.save()
    res.json({ message: 'Đổi trạng thái thành công', flashSale })
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err })
  }
}

//# PATCH /api/v1/admin/flashsales/change-status-many
module.exports.changeStatusMany = async (req, res) => {
  try {
    const { ids, status } = req.body
    if (!Array.isArray(ids) || !ids.length || !status) {
      return res.status(400).json({ message: 'Cần truyền ids và status' })
    }
    await FlashSale.updateMany({ _id: { $in: ids } }, { status })
    res.json({ message: `Đã cập nhật trạng thái cho ${ids.length} flash sale` })
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err })
  }
}

//# PATCH /api/v1/admin/flashsales/change-position-many
module.exports.changePositionMany = async (req, res) => {
  try {
    const { items } = req.body
    if (!Array.isArray(items) || !items.length) {
      return res.status(400).json({ message: 'Thiếu danh sách items' })
    }
    for (const { id, position } of items) {
      await FlashSale.findByIdAndUpdate(id, { position })
    }
    res.json({ message: 'Cập nhật vị trí thành công' })
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err })
  }
}
