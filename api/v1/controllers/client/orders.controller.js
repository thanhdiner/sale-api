const Order = require('../../models/order.model')
const PromoCode = require('../../models/promoCode.model')
const Product = require('../../models/products.model')
const FlashSale = require('../../models/flashSale.model')
const User = require('../../models/user.model')
const removeAccents = require('remove-accents')
const logger = require('../../../../config/logger')
const { getIO } = require('../../helpers/socket')
const { sendMail } = require('../../../../config/mailer')
const { orderConfirmedTemplate } = require('../../utils/emailTemplates')
const { normalizeStructuredAddress } = require('../../utils/structuredAddress')

/**
 * Resolve the best email to send the order confirmation to.
 * Priority: contact.email → user account email → null (skip)
 */
const resolveOrderEmail = async order => {
  if (order.contact?.email) {
    logger.debug(`[Mailer] Using contact.email: ${order.contact.email}`)
    return order.contact.email
  }
  if (order.userId) {
    const user = await User.findById(order.userId).select('email').lean()
    if (user?.email) {
      logger.debug(`[Mailer] contact.email empty — fallback to user.email: ${user.email}`)
      return user.email
    }
  }
  logger.warn(`[Mailer] No email found for order ${order._id} — skipping email`)
  return null
}

//# POST /api/v1/orders
module.exports.createOrder = async (req, res) => {
  try {
    const { contact, orderItems, deliveryMethod, paymentMethod, subtotal, discount, shipping, total, promo } = req.body
    if (!orderItems || !Array.isArray(orderItems) || orderItems.length === 0)
      return res.status(400).json({ error: 'Đơn hàng phải có sản phẩm' })

    let promoCodeDoc = null
    if (promo) {
      const promoCodeStr = typeof promo === 'string' ? promo : promo.code || ''
      promoCodeDoc = await PromoCode.findOne({ code: { $regex: new RegExp(`^${promoCodeStr.trim()}$`, 'i') }, isActive: true })
      if (!promoCodeDoc) return res.status(400).json({ error: 'Mã giảm giá không hợp lệ!' })
      if (promoCodeDoc.usedBy && promoCodeDoc.usedBy.includes(req.user?.userId)) {
        return res.status(400).json({ error: 'Bạn đã sử dụng mã giảm giá này rồi!' })
      }
      if (promoCodeDoc.usageLimit && promoCodeDoc.usedCount >= promoCodeDoc.usageLimit) {
        return res.status(400).json({ error: 'Mã giảm giá đã hết lượt sử dụng!' })
      }
      if (promoCodeDoc.expiresAt && promoCodeDoc.expiresAt < new Date()) {
        return res.status(400).json({ error: 'Mã giảm giá đã hết hạn!' })
      }
    }

    const productIds = orderItems.map(i => i.productId)
    const products = await Product.find({ _id: { $in: productIds } })
    const productsMap = Object.fromEntries(products.map(p => [p._id.toString(), p]))

    const populatedOrderItems = orderItems.map(item => {
      const product = productsMap[item.productId?.toString()]
      if (!product) throw new Error(`Không tìm thấy sản phẩm ${item.productId}`)
      const finalPrice = item.salePrice !== undefined ? item.salePrice : product.price
      return {
        ...item,
        price: finalPrice,
        costPrice: product.costPrice,
        name: item.name || product.title,
        image: item.image || product.thumbnail
      }
    })

    const normalizedContact = {
      ...contact,
      ...normalizeStructuredAddress(contact)
    }
    normalizedContact.firstNameNoAccent = removeAccents(normalizedContact.firstName)
    normalizedContact.lastNameNoAccent = removeAccents(normalizedContact.lastName)

    const newOrder = new Order({
      contact: normalizedContact,
      orderItems: populatedOrderItems,
      deliveryMethod,
      paymentMethod,
      subtotal,
      discount,
      shipping,
      total,
      promo: promoCodeDoc ? promoCodeDoc.code : '',
      status: 'pending',
      userId: req.user?.userId
    })

    await newOrder.save()

    // Bulk update kho hàng 1 lần
    const stockBulkOps = populatedOrderItems.map(item => ({
      updateOne: {
        filter: { _id: item.productId, stock: { $gte: item.quantity } },
        update: { $inc: { stock: -item.quantity, soldQuantity: item.quantity } }
      }
    }))
    const stockBulkResult = await Product.bulkWrite(stockBulkOps)
    // Nếu có 1 sản phẩm nào không update được (out of stock), trả về lỗi
    if (stockBulkResult.modifiedCount !== populatedOrderItems.length) {
      return res.status(400).json({ error: 'Có sản phẩm hết hàng hoặc không đủ số lượng!' })
    }

    // Update flashsale (nếu có)
    for (const item of populatedOrderItems) {
      if (item.isFlashSale && item.flashSaleId) {
        await FlashSale.updateOne(
          { _id: item.flashSaleId },
          {
            $inc: {
              soldQuantity: item.quantity,
              revenue: (item.salePrice || item.price) * item.quantity
            }
          }
        )
      }
    }

    // Update mã giảm giá (nếu có)
    if (promoCodeDoc) {
      await PromoCode.updateOne(
        { _id: promoCodeDoc._id },
        {
          $addToSet: { usedBy: req.user.userId },
          $inc: { usedCount: 1 }
        }
      )
    }

    res.json({ success: true, order: newOrder })

    // Notify admin realtime
    try {
      getIO().to('admin').emit('new_order', {
        _id: newOrder._id,
        contact: newOrder.contact,
        total: newOrder.total,
        paymentMethod: newOrder.paymentMethod,
        createdAt: newOrder.createdAt
      })
    } catch {}

    // Send confirmation email (fire-and-forget)
    resolveOrderEmail(newOrder).then(to => {
      if (to) {
        const { subject, html } = orderConfirmedTemplate(newOrder)
        sendMail({ to, subject, html })
      }
    }).catch(err => logger.error('[Mailer] resolveOrderEmail error:', err))
  } catch (err) {
    logger.error('[Client] createOrder error:', err)
    res.status(500).json({ error: 'Lỗi tạo đơn hàng' })
  }
}

//# POST /api/v1/orders/pending
//  Tạo đơn hàng với paymentStatus='pending' — dùng trước khi redirect sang cổng thanh toán
module.exports.createPendingOrder = async (req, res) => {
  try {
    const { contact, orderItems, deliveryMethod, paymentMethod, subtotal, discount, shipping, total, promo } = req.body
    if (!orderItems || !Array.isArray(orderItems) || orderItems.length === 0)
      return res.status(400).json({ error: 'Đơn hàng phải có sản phẩm' })

    const validOnline = ['vnpay', 'momo', 'zalopay']
    if (!validOnline.includes(paymentMethod))
      return res.status(400).json({ error: 'Phương thức thanh toán không hợp lệ cho đơn pending' })

    const productIds = orderItems.map(i => i.productId)
    const products = await Product.find({ _id: { $in: productIds } })
    const productsMap = Object.fromEntries(products.map(p => [p._id.toString(), p]))

    const populatedOrderItems = orderItems.map(item => {
      const product = productsMap[item.productId?.toString()]
      if (!product) throw new Error(`Không tìm thấy sản phẩm ${item.productId}`)
      const finalPrice = item.salePrice !== undefined ? item.salePrice : product.price
      return {
        ...item,
        price: finalPrice,
        costPrice: product.costPrice,
        name: item.name || product.title,
        image: item.image || product.thumbnail
      }
    })

    const normalizedContact = {
      ...contact,
      ...normalizeStructuredAddress(contact)
    }
    normalizedContact.firstNameNoAccent = removeAccents(normalizedContact.firstName)
    normalizedContact.lastNameNoAccent = removeAccents(normalizedContact.lastName)

    const newOrder = new Order({
      contact: normalizedContact,
      orderItems: populatedOrderItems,
      deliveryMethod,
      paymentMethod,
      subtotal,
      discount,
      shipping,
      total,
      promo: promo?.code || promo || '',
      status: 'pending',
      paymentStatus: 'pending',
      userId: req.user?.userId
    })

    await newOrder.save()

    // Trừ kho ngay (sẽ hoàn lại nếu thanh toán thất bại/hết timeout)
    const stockBulkOps = populatedOrderItems.map(item => ({
      updateOne: {
        filter: { _id: item.productId, stock: { $gte: item.quantity } },
        update: { $inc: { stock: -item.quantity, soldQuantity: item.quantity } }
      }
    }))
    const stockResult = await Product.bulkWrite(stockBulkOps)
    if (stockResult.modifiedCount !== populatedOrderItems.length) {
      await Order.deleteOne({ _id: newOrder._id })
      return res.status(400).json({ error: 'Có sản phẩm hết hàng hoặc không đủ số lượng!' })
    }

    res.json({ success: true, orderId: newOrder._id })
  } catch (err) {
    logger.error('[Client] createPendingOrder error:', err)
    res.status(500).json({ error: 'Lỗi tạo đơn hàng' })
  }
}

//# GET /api/v1/orders/my
module.exports.getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.user.userId, isDeleted: false }).sort({ createdAt: -1 })
    res.json({ success: true, orders })
  } catch (err) {
    res.status(500).json({ error: 'Lỗi lấy đơn hàng' })
  }
}

//# GET /api/v1/orders/:id
module.exports.getOrderDetail = async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, userId: req.user.userId, isDeleted: false })
    if (!order) return res.status(404).json({ error: 'Không tìm thấy đơn hàng' })
    res.json({ success: true, order })
  } catch (err) {
    res.status(500).json({ error: 'Lỗi lấy đơn hàng' })
  }
}

//# POST /api/v1/orders/cancel/:id
module.exports.cancelOrder = async (req, res) => {
  try {
    const userId = req.user?._id
    const orderId = req.params.id

    const order = await Order.findOne({ _id: orderId, 'contact.userId': userId })
    if (!order) return res.status(404).json({ error: 'Không tìm thấy đơn hàng' })
    if (order.status !== 'pending') {
      return res.status(400).json({ error: 'Đơn hàng không thể hủy' })
    }
    order.status = 'cancelled'
    order.cancelledAt = new Date()
    await order.save()

    res.json({ success: true, order })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

//# POST /api/v1/orders/track  (PUBLIC — không cần đăng nhập)
module.exports.trackOrder = async (req, res) => {
  try {
    const { orderCode, phone } = req.body

    if (!orderCode || !phone) {
      return res.status(400).json({ error: 'Vui lòng nhập mã đơn hàng và số điện thoại.' })
    }

    // Chuẩn hóa phone: bỏ khoảng trắng, dấu gạch
    const cleanPhone = phone.replace(/[\s\-\.]/g, '')

    // Chuẩn hóa orderCode: bỏ dấu # và khoảng trắng
    const cleanOrderCode = orderCode.trim().replace(/^#/, '')

    // Tìm đơn hàng theo _id và số điện thoại liên hệ
    let order = null
    try {
      order = await Order.findOne({
        _id: cleanOrderCode,
        'contact.phone': cleanPhone,
        isDeleted: false
      }).lean()
    } catch {
      // _id không hợp lệ (không phải ObjectId) → không tìm thấy
      order = null
    }

    if (!order) {
      return res.status(404).json({ error: 'Không tìm thấy đơn hàng hoặc số điện thoại không khớp.' })
    }

    // Chỉ trả về thông tin an toàn, không trả toàn bộ dữ liệu đơn hàng
    const statusMap = {
      pending: 'Chờ xác nhận',
      confirmed: 'Đã xác nhận',
      shipping: 'Đang giao hàng',
      completed: 'Hoàn thành',
      cancelled: 'Đã hủy'
    }

    const paymentStatusMap = {
      pending: 'Chưa thanh toán',
      paid: 'Đã thanh toán',
      failed: 'Thanh toán thất bại'
    }

    res.json({
      success: true,
      order: {
        id: order._id,
        status: order.status,
        statusLabel: statusMap[order.status] || order.status,
        paymentStatus: order.paymentStatus,
        paymentStatusLabel: paymentStatusMap[order.paymentStatus] || order.paymentStatus,
        paymentMethod: order.paymentMethod,
        total: order.total,
        itemCount: order.orderItems?.length || 0,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt
      }
    })
  } catch (err) {
    logger.error('[Client] trackOrder error:', err)
    res.status(500).json({ error: 'Lỗi tra cứu đơn hàng' })
  }
}
