const removeAccents = require('remove-accents')
const logger = require('../../../../config/logger')
const { getIO } = require('../../helpers/socket')
const { sendMail } = require('../../../../config/mailer')
const { orderConfirmedTemplate } = require('../../utils/emailTemplates')
const { normalizeStructuredAddress } = require('../../utils/structuredAddress')
const AppError = require('../../utils/AppError')
const orderRepository = require('../../repositories/order.repository')
const promoCodeRepository = require('../../repositories/promoCode.repository')
const productRepository = require('../../repositories/product.repository')
const flashSaleRepository = require('../../repositories/flashSale.repository')
const userRepository = require('../../repositories/user.repository')
const digitalDeliveryService = require('../digitalDelivery.service')

const ONLINE_PAYMENT_METHODS = ['vnpay', 'momo', 'zalopay']
const DEFAULT_PENDING_ONLINE_ORDER_TTL_MINUTES = 60

function getPendingOnlineOrderTtlMs() {
  const minutes = Number(process.env.PENDING_ONLINE_ORDER_TTL_MINUTES)
  const normalizedMinutes = Number.isFinite(minutes) && minutes > 0
    ? minutes
    : DEFAULT_PENDING_ONLINE_ORDER_TTL_MINUTES

  return normalizedMinutes * 60 * 1000
}

function getReservationExpiresAt() {
  return new Date(Date.now() + getPendingOnlineOrderTtlMs())
}

async function resolveOrderEmail(order) {
  if (order.contact?.email) {
    logger.debug(`[Mailer] Using contact.email: ${order.contact.email}`)
    return order.contact.email
  }

  if (order.userId) {
    const user = await userRepository.findEmailById(order.userId)
    if (user?.email) {
      logger.debug(`[Mailer] contact.email empty — fallback to user.email: ${user.email}`)
      return user.email
    }
  }

  logger.warn(`[Mailer] No email found for order ${order._id} — skipping email`)
  return null
}

function normalizeOrderContact(contact = {}) {
  const normalizedContact = {
    ...contact,
    ...normalizeStructuredAddress(contact)
  }

  normalizedContact.firstNameNoAccent = removeAccents(normalizedContact.firstName)
  normalizedContact.lastNameNoAccent = removeAccents(normalizedContact.lastName)

  return normalizedContact
}

async function resolvePromoCode(promo, userId) {
  if (!promo) {
    return null
  }

  const promoCodeStr = typeof promo === 'string' ? promo : promo.code || ''
  const promoCodeDoc = await promoCodeRepository.findOne({
    code: { $regex: new RegExp(`^${promoCodeStr.trim()}$`, 'i') },
    isActive: true
  })

  if (!promoCodeDoc) throw new AppError('Mã giảm giá không hợp lệ!', 400)
  if (promoCodeDoc.usedBy?.some(usedUserId => String(usedUserId) === String(userId))) {
    throw new AppError('Bạn đã sử dụng mã giảm giá này rồi!', 400)
  }
  if (promoCodeDoc.usageLimit && promoCodeDoc.usedCount >= promoCodeDoc.usageLimit) {
    throw new AppError('Mã giảm giá đã hết lượt sử dụng!', 400)
  }
  if (promoCodeDoc.expiresAt && promoCodeDoc.expiresAt < new Date()) {
    throw new AppError('Mã giảm giá đã hết hạn!', 400)
  }

  return promoCodeDoc
}

async function populateOrderItems(orderItems = []) {
  const productIds = orderItems.map(item => item.productId)
  const products = await productRepository.findByQuery({ _id: { $in: productIds } })
  const productsMap = Object.fromEntries(products.map(product => [product._id.toString(), product]))

  return orderItems.map(item => {
    const product = productsMap[item.productId?.toString()]
    if (!product) {
      throw new Error(`Không tìm thấy sản phẩm ${item.productId}`)
    }

    const finalPrice = item.salePrice !== undefined ? item.salePrice : product.price
    return {
      ...item,
      price: finalPrice,
      costPrice: product.costPrice,
      name: item.name || product.title,
      image: item.image || product.thumbnail,
      deliveryType: product.deliveryType || 'manual',
      deliveryInstructions: product.deliveryInstructions || ''
    }
  })
}

async function applyStockDeduction(orderItems = []) {
  const manualItems = orderItems.filter(item => item.deliveryType !== 'instant_account')
  if (!manualItems.length) {
    return { modifiedCount: 0, expectedCount: 0 }
  }

  const stockBulkOps = manualItems.map(item => ({
    updateOne: {
      filter: { _id: item.productId, stock: { $gte: item.quantity } },
      update: { $inc: { stock: -item.quantity, soldQuantity: item.quantity } }
    }
  }))

  const result = await productRepository.bulkWrite(stockBulkOps)
  result.expectedCount = manualItems.length
  digitalDeliveryService.invalidateProductCaches()
  return result
}

async function restoreOrderStock(order) {
  if (!order?.stockApplied) {
    return
  }

  const manualItems = order.orderItems.filter(item => item.deliveryType !== 'instant_account')
  const stockBulkOps = manualItems.map(item => ({
    updateOne: {
      filter: { _id: item.productId },
      update: { $inc: { stock: item.quantity, soldQuantity: -item.quantity } }
    }
  }))

  if (stockBulkOps.length) {
    await productRepository.bulkWrite(stockBulkOps)
    digitalDeliveryService.invalidateProductCaches()
  }

  await digitalDeliveryService.releaseOrderReservations(order)

  order.stockApplied = false
}

function calculateItemsSubtotal(orderItems = []) {
  return orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
}

function calculatePromoDiscount(promoCodeDoc, subtotal) {
  if (!promoCodeDoc) return 0

  let discount = 0
  if (promoCodeDoc.discountType === 'percent') {
    discount = Math.floor((subtotal * Number(promoCodeDoc.discountValue || 0)) / 100)
    if (promoCodeDoc.maxDiscount) {
      discount = Math.min(discount, Number(promoCodeDoc.maxDiscount))
    }
  } else {
    discount = Number(promoCodeDoc.discountValue || 0)
  }

  return Math.min(Math.max(discount, 0), subtotal)
}

function ensurePromoMinimumOrder(promoCodeDoc, subtotal) {
  if (promoCodeDoc?.minOrder && subtotal < promoCodeDoc.minOrder) {
    throw new AppError('Don hang chua dat gia tri toi thieu de dung ma giam gia', 400)
  }
}

function calculateOrderTotals(orderItems = [], discount = 0, shipping = 0) {
  const subtotal = calculateItemsSubtotal(orderItems)
  const normalizedDiscount = Math.min(Math.max(Number(discount) || 0, 0), subtotal)
  const normalizedShipping = Math.max(Number(shipping) || 0, 0)

  return {
    subtotal,
    discount: normalizedDiscount,
    shipping: normalizedShipping,
    total: subtotal - normalizedDiscount + normalizedShipping
  }
}

async function updateFlashSaleStats(orderItems = []) {
  for (const item of orderItems) {
    if (item.isFlashSale && item.flashSaleId) {
      await flashSaleRepository.updateOne(
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
}

async function markPromoCodeUsed(promoCodeDoc, userId) {
  if (!promoCodeDoc || !userId) {
    return
  }

  await promoCodeRepository.updateOne(
    { _id: promoCodeDoc._id },
    {
      $addToSet: { usedBy: userId },
      $inc: { usedCount: 1 }
    }
  )
}

async function markOrderPromoUsed(order) {
  if (!order?.promo || !order.userId || order.promoApplied) {
    return false
  }

  const promoCodeDoc = await promoCodeRepository.findOne({
    code: { $regex: new RegExp(`^${String(order.promo).trim()}$`, 'i') }
  })

  if (!promoCodeDoc) {
    return false
  }

  await markPromoCodeUsed(promoCodeDoc, order.userId)
  order.promoApplied = true
  return true
}

function emitNewOrder(order) {
  try {
    getIO().to('admin').emit('new_order', {
      _id: order._id,
      contact: order.contact,
      total: order.total,
      paymentMethod: order.paymentMethod,
      createdAt: order.createdAt
    })
  } catch {}
}

function queueOrderEmail(order) {
  resolveOrderEmail(order)
    .then(to => {
      if (to) {
        const { subject, html } = orderConfirmedTemplate(order)
        sendMail({ to, subject, html })
      }
    })
    .catch(err => logger.error('[Mailer] resolveOrderEmail error:', err))
}

async function createOrder(userId, payload = {}) {
  const { contact, orderItems, deliveryMethod, paymentMethod, shipping, promo } = payload

  if (!orderItems || !Array.isArray(orderItems) || orderItems.length === 0) {
    throw new AppError('Đơn hàng phải có sản phẩm', 400)
  }

  const promoCodeDoc = await resolvePromoCode(promo, userId)
  const populatedOrderItems = await populateOrderItems(orderItems)
  const subtotal = calculateItemsSubtotal(populatedOrderItems)
  ensurePromoMinimumOrder(promoCodeDoc, subtotal)
  const totals = calculateOrderTotals(populatedOrderItems, calculatePromoDiscount(promoCodeDoc, subtotal), shipping)
  const order = await orderRepository.create({
    contact: normalizeOrderContact(contact),
    orderItems: populatedOrderItems,
    deliveryMethod,
    paymentMethod,
    ...totals,
    promo: promoCodeDoc ? promoCodeDoc.code : '',
    status: 'pending',
    userId
  })

  const stockBulkResult = await applyStockDeduction(populatedOrderItems)
  if (stockBulkResult.modifiedCount !== stockBulkResult.expectedCount) {
    await orderRepository.deleteOne({ _id: order._id })
    throw new AppError('Có sản phẩm hết hàng hoặc không đủ số lượng!', 400)
  }

  order.stockApplied = true

  try {
    await digitalDeliveryService.reserveCredentialsForOrder(order, populatedOrderItems)
  } catch (error) {
    await restoreOrderStock(order)
    await orderRepository.deleteOne({ _id: order._id })
    throw error
  }

  await order.save()

  await updateFlashSaleStats(populatedOrderItems)
  await markPromoCodeUsed(promoCodeDoc, userId)
  if (promoCodeDoc && userId) {
    order.promoApplied = true
    await order.save()
  }
  emitNewOrder(order)
  queueOrderEmail(order)

  return { success: true, order }
}

async function createPendingOrder(userId, payload = {}) {
  const { contact, orderItems, deliveryMethod, paymentMethod, shipping, promo } = payload

  if (!orderItems || !Array.isArray(orderItems) || orderItems.length === 0) {
    throw new AppError('Đơn hàng phải có sản phẩm', 400)
  }

  if (!ONLINE_PAYMENT_METHODS.includes(paymentMethod)) {
    throw new AppError('Phương thức thanh toán không hợp lệ cho đơn pending', 400)
  }

  const promoCodeDoc = await resolvePromoCode(promo, userId)
  const populatedOrderItems = await populateOrderItems(orderItems)
  const subtotal = calculateItemsSubtotal(populatedOrderItems)
  ensurePromoMinimumOrder(promoCodeDoc, subtotal)
  const totals = calculateOrderTotals(populatedOrderItems, calculatePromoDiscount(promoCodeDoc, subtotal), shipping)
  const order = await orderRepository.create({
    contact: normalizeOrderContact(contact),
    orderItems: populatedOrderItems,
    deliveryMethod,
    paymentMethod,
    ...totals,
    promo: promoCodeDoc ? promoCodeDoc.code : '',
    status: 'pending',
    paymentStatus: 'pending',
    reservationExpiresAt: getReservationExpiresAt(),
    userId
  })

  const stockResult = await applyStockDeduction(populatedOrderItems)
  if (stockResult.modifiedCount !== stockResult.expectedCount) {
    await orderRepository.deleteOne({ _id: order._id })
    throw new AppError('Có sản phẩm hết hàng hoặc không đủ số lượng!', 400)
  }

  order.stockApplied = true

  try {
    await digitalDeliveryService.reserveCredentialsForOrder(order, populatedOrderItems)
  } catch (error) {
    await restoreOrderStock(order)
    await orderRepository.deleteOne({ _id: order._id })
    throw error
  }

  await order.save()

  return { success: true, orderId: order._id }
}

async function getMyOrders(userId) {
  const orders = await orderRepository.findByQuery({ userId, isDeleted: false }, {
    sort: { createdAt: -1 },
    select: '-orderItems.digitalDeliveries.password -orderItems.digitalDeliveries.username -orderItems.digitalDeliveries.email -orderItems.digitalDeliveries.licenseKey -orderItems.digitalDeliveries.loginUrl -orderItems.digitalDeliveries.notes -orderItems.digitalDeliveries.instructions'
  })

  return { success: true, orders }
}

async function getOrderDetail(userId, orderId) {
  const order = await orderRepository.findOne({ _id: orderId, userId, isDeleted: false })
  if (!order) {
    throw new AppError('Không tìm thấy đơn hàng', 404)
  }

  return { success: true, order }
}

async function cancelOrder(userId, orderId) {
  const order = await orderRepository.findOne({ _id: orderId, userId, isDeleted: false })
  if (!order) {
    throw new AppError('Không tìm thấy đơn hàng', 404)
  }
  if (order.status !== 'pending') {
    throw new AppError('Đơn hàng không thể hủy', 400)
  }

  await restoreOrderStock(order)
  order.status = 'cancelled'
  order.cancelledAt = new Date()
  await order.save()

  return { success: true, order }
}

async function trackOrder({ orderCode, phone }) {
  if (!orderCode || !phone) {
    throw new AppError('Vui lòng nhập mã đơn hàng và số điện thoại.', 400)
  }

  const cleanPhone = phone.replace(/[\s\-\.]/g, '')
  const cleanOrderCode = orderCode.trim().replace(/^#/, '')

  let order = null
  try {
    order = await orderRepository.findOne({
      _id: cleanOrderCode,
      'contact.phone': cleanPhone,
      isDeleted: false
    }, { lean: true })
  } catch {
    order = null
  }

  if (!order) {
    throw new AppError('Không tìm thấy đơn hàng hoặc số điện thoại không khớp.', 404)
  }

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

  return {
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
  }
}

async function expirePendingOnlineOrders({ now = new Date(), batchSize = 100 } = {}) {
  const fallbackCutoff = new Date(now.getTime() - getPendingOnlineOrderTtlMs())
  const orders = await orderRepository.findByQuery({
    paymentMethod: { $in: ONLINE_PAYMENT_METHODS },
    paymentStatus: 'pending',
    status: 'pending',
    stockApplied: true,
    isDeleted: false,
    $or: [
      { reservationExpiresAt: { $lte: now } },
      { reservationExpiresAt: { $exists: false }, createdAt: { $lte: fallbackCutoff } }
    ]
  }, {
    sort: { createdAt: 1 },
    limit: batchSize
  })

  let expiredCount = 0

  for (const order of orders) {
    await restoreOrderStock(order)
    order.paymentStatus = 'failed'
    order.status = 'cancelled'
    order.paymentExpiredAt = now
    order.cancelledAt = now
    await order.save()
    expiredCount += 1
  }

  return { success: true, expiredCount }
}

module.exports = {
  createOrder,
  createPendingOrder,
  getMyOrders,
  getOrderDetail,
  cancelOrder,
  trackOrder,
  restoreOrderStock,
  markOrderPromoUsed,
  expirePendingOnlineOrders,
  ONLINE_PAYMENT_METHODS,
  getPendingOnlineOrderTtlMs
}
