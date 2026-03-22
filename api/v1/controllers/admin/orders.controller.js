const Order = require('../../models/order.model')
const removeAccents = require('remove-accents')
const logger = require('../../../../config/logger')
const { getIO } = require('../../helpers/socket')

//# GET /api/v1/orders
module.exports.getAllOrders = async (req, res) => {
  try {
    const { page = 1, limit = 20, keyword = '', status = '' } = req.query
    const pageNum = parseInt(page, 10) || 1
    const pageLimit = parseInt(limit, 10) || 20
    const query = { isDeleted: false }

    if (status && status !== '') {
      query.status = status
    }

    if (keyword) {
      const keywordNoAccent = removeAccents(keyword)
      // Kiểm tra nếu là ObjectId hợp lệ
      const isObjectId = keyword.length === 24 && keyword.match(/^[a-fA-F0-9]{24}$/)
      if (keyword === keywordNoAccent) {
        // Không dấu: search cả không dấu & có dấu, thêm phone, email, notes, _id
        query.$or = [
          { 'contact.firstNameNoAccent': { $regex: keyword, $options: 'i' } },
          { 'contact.lastNameNoAccent': { $regex: keyword, $options: 'i' } },
          { 'contact.firstName': { $regex: keyword, $options: 'i' } },
          { 'contact.lastName': { $regex: keyword, $options: 'i' } },
          { 'contact.phone': { $regex: keyword, $options: 'i' } },
          { 'contact.email': { $regex: keyword, $options: 'i' } },
          { 'contact.notes': { $regex: keyword, $options: 'i' } },
          ...(isObjectId ? [{ _id: keyword }] : [])
        ]
      } else {
        // Có dấu: chỉ search trường có dấu, + phone, email, notes, _id
        query.$or = [
          { 'contact.firstName': { $regex: keyword, $options: 'i' } },
          { 'contact.lastName': { $regex: keyword, $options: 'i' } },
          { 'contact.phone': { $regex: keyword, $options: 'i' } },
          { 'contact.email': { $regex: keyword, $options: 'i' } },
          { 'contact.notes': { $regex: keyword, $options: 'i' } },
          ...(isObjectId ? [{ _id: keyword }] : [])
        ]
      }
    }

    const total = await Order.countDocuments(query)
    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * pageLimit)
      .limit(Number(pageLimit))
    res.json({ success: true, orders, total })
  } catch (err) {
    logger.error('[Admin] getAllOrders error:', err)
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

    // Notify client realtime về trạng thái đơn hàng
    try {
      if (order.userId) {
        logger.info(`[Socket] Emitting order_status_updated to user_${order.userId}, status: ${order.status}`)
        getIO().to(`user_${order.userId}`).emit('order_status_updated', {
          _id: order._id,
          status: order.status,
          paymentStatus: order.paymentStatus
        })
      } else {
        logger.warn(`[Socket] Order ${order._id} has no userId — cannot notify client`)
      }
    } catch (e) {
      logger.error('[Socket] Emit error:', e.message)
    }

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
