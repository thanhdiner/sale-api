const Order = require('../../models/order.model')

//# GET /api/v1/orders
module.exports.getAllOrders = async (req, res) => {
  try {
    const { page = 1, limit = 20, keyword = '' } = req.query
    const query = { isDeleted: false }
    if (keyword) query['contact.phone'] = { $regex: keyword, $options: 'i' }
    const total = await Order.countDocuments(query)
    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
    res.json({ success: true, orders, total })
  } catch (err) {
    res.status(500).json({ error: 'Lỗi lấy đơn hàng' })
  }
}

//# GET /api/v1/orders/:id
module.exports.getOrderDetailAdmin = async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, isDeleted: false })
    if (!order) return res.status(404).json({ error: 'Không tìm thấy đơn hàng' })
    res.json({ success: true, order })
  } catch (err) {
    res.status(500).json({ error: 'Lỗi lấy đơn hàng' })
  }
}

//# POST /api/v1/orders/:id
module.exports.updateOrderStatus = async (req, res) => {
  try {
    const { status, transferInfo } = req.body
    const order = await Order.findOne({ _id: req.params.id, isDeleted: false })
    if (!order) return res.status(404).json({ error: 'Không tìm thấy đơn hàng' })

    if (status) order.status = status
    if (transferInfo) order.transferInfo = transferInfo

    await order.save()
    res.json({ success: true, order })
  } catch (err) {
    res.status(500).json({ error: 'Lỗi cập nhật đơn hàng' })
  }
}

//# DELETE /api/v1/orders/:id
module.exports.deleteOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
    if (!order) return res.status(404).json({ error: 'Không tìm thấy đơn hàng' })
    order.isDeleted = true
    await order.save()
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: 'Lỗi xóa đơn hàng' })
  }
}
