const removeAccents = require('remove-accents')
const logger = require('../../../../config/logger')
const { getIO } = require('../../helpers/socket')
const { sendMail } = require('../../../../config/mailer')
const { orderConfirmedTemplate } = require('../../utils/emailTemplates')
const {
  normalizeStructuredAddress,
  hasCompleteStructuredAddress
} = require('../../utils/structuredAddress')
const AppError = require('../../utils/AppError')
const orderRepository = require('../../repositories/order.repository')
const promoCodeRepository = require('../../repositories/promoCode.repository')
const productRepository = require('../../repositories/product.repository')
const flashSaleRepository = require('../../repositories/flashSale.repository')
const userRepository = require('../../repositories/user.repository')
const digitalDeliveryService = require('../digitalDelivery.service')
const notificationsService = require('./notifications.service')
const { notifyBackInStockForProduct } = require('../backInStock.service')

const ONLINE_PAYMENT_METHODS = ['vnpay', 'momo', 'zalopay', 'sepay']
const DEFAULT_PENDING_ONLINE_ORDER_TTL_MINUTES = 60
const FREE_SHIPPING_THRESHOLD = 100000
const DEFAULT_SHIPPING_FEE = 50000
const ORDER_DELIVERY_METHODS = ['pickup', 'contact']
const ORDER_ADDRESS_FIELDS = [
  'addressLine1',
  'provinceCode',
  'provinceName',
  'districtCode',
  'districtName',
  'wardCode',
  'wardName',
  'address'
]
const ORDER_ADDRESS_LOCATION_FIELDS = [
  'provinceCode',
  'provinceName',
  'districtCode',
  'districtName',
  'wardCode',
  'wardName'
]

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

  if (promoCodeDoc?.startsAt && promoCodeDoc.startsAt > new Date()) {
    throw new AppError('Ma giam gia chua den thoi gian su dung', 400)
  }

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

async function rollbackManualStockDeductions(items = []) {
  const manualItems = items.filter(item => item.deliveryType !== 'instant_account')
  if (!manualItems.length) return

  await productRepository.bulkWrite(manualItems.map(item => ({
    updateOne: {
      filter: { _id: item.productId },
      update: { $inc: { stock: item.quantity, soldQuantity: -item.quantity } }
    }
  })))
  digitalDeliveryService.invalidateProductCaches()
}

async function applyStockDeductionStrict(orderItems = []) {
  const manualItems = orderItems.filter(item => item.deliveryType !== 'instant_account')
  const deductedItems = []

  try {
    for (const item of manualItems) {
      const result = await productRepository.updateOne(
        { _id: item.productId, stock: { $gte: item.quantity } },
        { $inc: { stock: -item.quantity, soldQuantity: item.quantity } }
      )

      if (result.modifiedCount !== 1) {
        throw new AppError(`San pham ${item.name || item.productId} khong du ton kho de cap nhat don hang`, 400)
      }

      deductedItems.push(item)
    }

    if (deductedItems.length) {
      digitalDeliveryService.invalidateProductCaches()
    }

    return { modifiedCount: deductedItems.length, expectedCount: manualItems.length }
  } catch (error) {
    await rollbackManualStockDeductions(deductedItems)
    throw error
  }
}

async function restoreOrderStock(order) {
  if (!order?.stockApplied) {
    return
  }

  const manualItems = order.orderItems.filter(item => item.deliveryType !== 'instant_account')
  const restoredQuantityByProductId = manualItems.reduce((map, item) => {
    const productId = item.productId?.toString()
    if (!productId) return map

    map.set(productId, (map.get(productId) || 0) + Number(item.quantity || 0))
    return map
  }, new Map())
  const previousProducts = restoredQuantityByProductId.size
    ? await productRepository.findByQuery(
      { _id: { $in: [...restoredQuantityByProductId.keys()] } },
      { select: '_id stock', lean: true }
    )
    : []
  const previousStockByProductId = new Map(
    previousProducts.map(product => [product._id?.toString(), Number(product.stock || 0)])
  )
  const stockBulkOps = manualItems.map(item => ({
    updateOne: {
      filter: { _id: item.productId },
      update: { $inc: { stock: item.quantity, soldQuantity: -item.quantity } }
    }
  }))

  if (stockBulkOps.length) {
    await productRepository.bulkWrite(stockBulkOps)
    digitalDeliveryService.invalidateProductCaches()

    const backInStockProductIds = [...restoredQuantityByProductId.entries()]
      .filter(([productId, restoredQuantity]) => {
        const previousStock = previousStockByProductId.get(productId) || 0
        return previousStock <= 0 && previousStock + restoredQuantity > 0
      })
      .map(([productId]) => productId)

    await Promise.all(backInStockProductIds.map(productId => notifyBackInStockForProduct(productId)))
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

function normalizeOrderDeliveryMethod(value) {
  const normalized = String(value || '').trim().toLowerCase()
  return ORDER_DELIVERY_METHODS.includes(normalized) ? normalized : null
}

function calculatePendingOrderDeliveryShipping(deliveryMethod, subtotal, shipping) {
  const explicitShipping = Number(shipping)
  if (Number.isFinite(explicitShipping) && explicitShipping >= 0) {
    return explicitShipping
  }

  if (deliveryMethod === 'pickup') return 0

  return Number(subtotal || 0) > FREE_SHIPPING_THRESHOLD ? 0 : DEFAULT_SHIPPING_FEE
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

  if (['transfer', 'contact'].includes(paymentMethod)) {
    throw new AppError('Thanh toan chuyen khoan/thoa thuan dang tam tat. Vui long thanh toan online.', 400)
  }

  if (ONLINE_PAYMENT_METHODS.includes(paymentMethod)) {
    throw new AppError('Vui long tao don pending va thanh toan qua cong online.', 400)
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

  return {
    success: true,
    orderId: order._id,
    orderCode: order.orderCode,
    paymentReference: order.orderCode || order._id.toString(),
    amount: order.total
  }
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
  notificationsService.createOrderStatusNotification(order)

  return { success: true, order }
}

function normalizeOrderContactUpdate(payload = {}) {
  const update = {}

  if (Object.prototype.hasOwnProperty.call(payload, 'phone')) {
    const phone = String(payload.phone || '').trim().replace(/[\s\-\.]/g, '')
    if (!phone) {
      throw new AppError('So dien thoai khong duoc de trong', 400)
    }
    if (!/^[0-9]{9,15}$/.test(phone)) {
      throw new AppError('So dien thoai khong hop le', 400)
    }
    update.phone = phone
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'email')) {
    const email = String(payload.email || '').trim().toLowerCase()
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new AppError('Email khong hop le', 400)
    }
    update.email = email
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'notes')) {
    update.notes = String(payload.notes || '').trim().slice(0, 500)
  }

  if (Object.keys(update).length === 0) {
    throw new AppError('Vui long cung cap so dien thoai, email hoac ghi chu can cap nhat', 400)
  }

  return update
}

function hasOwnField(payload = {}, field) {
  return Object.prototype.hasOwnProperty.call(payload, field)
}

function cleanOrderAddressValue(value) {
  return String(value || '').trim()
}

function hasOrderAddressInput(payload = {}) {
  return ORDER_ADDRESS_FIELDS.some(field => (
    hasOwnField(payload, field) && cleanOrderAddressValue(payload[field])
  ))
}

function hasOrderAddressStructuredInput(payload = {}) {
  return ['addressLine1', ...ORDER_ADDRESS_LOCATION_FIELDS].some(field => (
    hasOwnField(payload, field) && cleanOrderAddressValue(payload[field])
  ))
}

function hasOrderAddressLocationInput(payload = {}) {
  return ORDER_ADDRESS_LOCATION_FIELDS.some(field => hasOwnField(payload, field))
}

function normalizeOrderAddressUpdate(payload = {}, currentContact = {}) {
  if (!hasOrderAddressInput(payload)) {
    throw new AppError('Vui long cung cap dia chi giao hang moi', 400)
  }

  const current = currentContact?.toObject ? currentContact.toObject() : (currentContact || {})
  const freeformAddress = hasOwnField(payload, 'address')
    ? cleanOrderAddressValue(payload.address)
    : ''
  let normalizedAddress

  if (freeformAddress && !hasOrderAddressStructuredInput(payload)) {
    normalizedAddress = {
      addressLine1: freeformAddress,
      provinceCode: '',
      provinceName: '',
      districtCode: '',
      districtName: '',
      wardCode: '',
      wardName: '',
      address: freeformAddress
    }
  } else {
    const addressInput = ORDER_ADDRESS_FIELDS.reduce((result, field) => {
      result[field] = hasOwnField(payload, field) ? payload[field] : current[field]
      return result
    }, {})

    if (hasOrderAddressLocationInput(payload) && !hasCompleteStructuredAddress(addressInput)) {
      throw new AppError('Dia chi co cau truc phai day du tinh/thanh, quan/huyen, phuong/xa va dia chi chi tiet', 400)
    }

    normalizedAddress = normalizeStructuredAddress(addressInput)
  }

  if (!cleanOrderAddressValue(normalizedAddress.address)) {
    throw new AppError('Dia chi giao hang khong duoc de trong', 400)
  }

  const update = normalizedAddress

  if (hasOwnField(payload, 'notes')) {
    update.notes = cleanOrderAddressValue(payload.notes).slice(0, 500)
  }

  return update
}

async function updateOrderContact(userId, orderId, payload = {}) {
  const order = await orderRepository.findOne({ _id: orderId, userId, isDeleted: false })
  if (!order) {
    throw new AppError('Khong tim thay don hang', 404)
  }
  if (order.status !== 'pending') {
    throw new AppError('Chi co the sua thong tin lien he cua don dang cho xac nhan', 400)
  }

  const update = normalizeOrderContactUpdate(payload)
  order.contact = {
    ...(order.contact?.toObject ? order.contact.toObject() : order.contact),
    ...update
  }

  await order.save()
  return { success: true, order }
}

async function updateOrderAddress(userId, orderId, payload = {}) {
  const order = await orderRepository.findOne({ _id: orderId, userId, isDeleted: false })
  if (!order) {
    throw new AppError('Khong tim thay don hang', 404)
  }
  if (order.status !== 'pending') {
    throw new AppError('Chi co the sua dia chi giao hang cua don dang cho xac nhan', 400)
  }

  const update = normalizeOrderAddressUpdate(payload, order.contact)
  order.contact = {
    ...(order.contact?.toObject ? order.contact.toObject() : order.contact),
    ...update
  }

  await order.save()
  return { success: true, order }
}

function clonePlain(value) {
  return JSON.parse(JSON.stringify(value || null))
}

function normalizeOrderItemsUpdatePayload(payload = {}) {
  const rawItems = Array.isArray(payload.orderItems)
    ? payload.orderItems
    : (Array.isArray(payload.items) ? payload.items : [])

  if (rawItems.length === 0) {
    throw new AppError('Vui long cung cap danh sach san pham moi cua don hang', 400)
  }

  const groupedItems = new Map()

  for (const item of rawItems) {
    const productId = String(item?.productId || '').trim()
    const quantity = Number(item?.quantity)

    if (!/^[0-9a-f\d]{24}$/i.test(productId)) {
      throw new AppError('Danh sach san pham cap nhat co productId khong hop le', 400)
    }

    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new AppError('So luong san pham cap nhat phai la so nguyen lon hon 0', 400)
    }

    const current = groupedItems.get(productId)
    groupedItems.set(productId, {
      ...item,
      productId,
      quantity: (current?.quantity || 0) + quantity
    })
  }

  return [...groupedItems.values()]
}

function buildOrderSnapshot(order) {
  return {
    deliveryMethod: order.deliveryMethod,
    orderItems: clonePlain(order.orderItems) || [],
    subtotal: order.subtotal,
    discount: order.discount,
    shipping: order.shipping,
    total: order.total,
    promo: order.promo,
    stockApplied: order.stockApplied,
    hasDigitalDelivery: order.hasDigitalDelivery
  }
}

async function restorePendingOrderSnapshot(order, snapshot) {
  order.orderItems = clonePlain(snapshot.orderItems) || []
  order.subtotal = snapshot.subtotal
  order.discount = snapshot.discount
  order.shipping = snapshot.shipping
  order.total = snapshot.total
  order.promo = snapshot.promo
  order.stockApplied = false
  order.hasDigitalDelivery = snapshot.hasDigitalDelivery

  if (snapshot.stockApplied) {
    await applyStockDeductionStrict(order.orderItems)
    order.stockApplied = true

    try {
      await digitalDeliveryService.reserveCredentialsForOrder(order, order.orderItems)
    } catch (error) {
      await restoreOrderStock(order)
      throw error
    }
  }

  await order.save()
}

async function updatePendingOrderItems(userId, orderId, payload = {}) {
  const order = await orderRepository.findOne({ _id: orderId, userId, isDeleted: false })
  if (!order) {
    throw new AppError('Khong tim thay don hang', 404)
  }
  if (order.status !== 'pending' || order.paymentStatus !== 'pending') {
    throw new AppError('Chi co the sua san pham cua don pending chua thanh toan', 400)
  }
  if (order.reservationExpiresAt && new Date(order.reservationExpiresAt).getTime() <= Date.now()) {
    throw new AppError('Don hang da het han thanh toan, vui long tao don moi', 400)
  }

  const nextOrderItemsInput = normalizeOrderItemsUpdatePayload(payload)
  const promoCodeDoc = await resolvePromoCode(order.promo, userId)
  const nextOrderItems = await populateOrderItems(nextOrderItemsInput)
  const subtotal = calculateItemsSubtotal(nextOrderItems)
  ensurePromoMinimumOrder(promoCodeDoc, subtotal)
  const totals = calculateOrderTotals(
    nextOrderItems,
    calculatePromoDiscount(promoCodeDoc, subtotal),
    order.shipping
  )
  const previousSnapshot = buildOrderSnapshot(order)

  try {
    await restoreOrderStock(order)

    order.orderItems = nextOrderItems
    order.subtotal = totals.subtotal
    order.discount = totals.discount
    order.shipping = totals.shipping
    order.total = totals.total
    order.stockApplied = false
    order.hasDigitalDelivery = false

    await applyStockDeductionStrict(nextOrderItems)
    order.stockApplied = true

    try {
      await digitalDeliveryService.reserveCredentialsForOrder(order, nextOrderItems)
    } catch (error) {
      await restoreOrderStock(order)
      throw error
    }

    await order.save()

    return {
      success: true,
      order,
      previous: {
        subtotal: previousSnapshot.subtotal,
        discount: previousSnapshot.discount,
        shipping: previousSnapshot.shipping,
        total: previousSnapshot.total,
        itemCount: previousSnapshot.orderItems.length
      }
    }
  } catch (error) {
    try {
      if (order.stockApplied) {
        await restoreOrderStock(order)
      }
      await restorePendingOrderSnapshot(order, previousSnapshot)
    } catch (restoreError) {
      logger.error(`[Order] Failed to restore pending order ${orderId} after item update failure: ${restoreError.stack || restoreError.message}`)
    }

    throw error
  }
}

function ensurePendingOrderPromoEditable(order) {
  if (order.status !== 'pending' || order.paymentStatus !== 'pending') {
    throw new AppError('Chi co the sua ma giam gia cua don pending chua thanh toan', 400)
  }
  if (order.reservationExpiresAt && new Date(order.reservationExpiresAt).getTime() <= Date.now()) {
    throw new AppError('Don hang da het han thanh toan, vui long tao don moi', 400)
  }
  if (order.promoApplied) {
    throw new AppError('Ma giam gia cua don da duoc ghi nhan su dung, khong the thay doi', 400)
  }
}

function buildPromoOrderChangePrevious(order) {
  return {
    promo: order.promo || '',
    subtotal: order.subtotal,
    discount: order.discount,
    shipping: order.shipping,
    total: order.total
  }
}

function recalculatePendingOrderTotals(order, promoCodeDoc = null) {
  const orderItems = Array.isArray(order.orderItems) ? order.orderItems : []
  const subtotal = calculateItemsSubtotal(orderItems)
  if (promoCodeDoc) ensurePromoMinimumOrder(promoCodeDoc, subtotal)

  return calculateOrderTotals(
    orderItems,
    calculatePromoDiscount(promoCodeDoc, subtotal),
    order.shipping
  )
}

async function applyPromoCodeToPendingOrder(userId, orderId, code) {
  const normalizedCode = String(code || '').trim().toUpperCase()
  if (!normalizedCode) {
    throw new AppError('Vui long cung cap ma giam gia can ap', 400)
  }

  const order = await orderRepository.findOne({ _id: orderId, userId, isDeleted: false })
  if (!order) {
    throw new AppError('Khong tim thay don hang', 404)
  }
  ensurePendingOrderPromoEditable(order)

  const previous = buildPromoOrderChangePrevious(order)
  const promoCodeDoc = await resolvePromoCode(normalizedCode, userId)
  const totals = recalculatePendingOrderTotals(order, promoCodeDoc)

  order.subtotal = totals.subtotal
  order.discount = totals.discount
  order.shipping = totals.shipping
  order.total = totals.total
  order.promo = promoCodeDoc ? promoCodeDoc.code : ''
  order.promoApplied = false
  order.paymentTransactionId = ''

  await order.save()

  return {
    success: true,
    order,
    promo: promoCodeDoc,
    previous
  }
}

async function removePromoCodeFromPendingOrder(userId, orderId) {
  const order = await orderRepository.findOne({ _id: orderId, userId, isDeleted: false })
  if (!order) {
    throw new AppError('Khong tim thay don hang', 404)
  }
  ensurePendingOrderPromoEditable(order)

  const previous = buildPromoOrderChangePrevious(order)
  const removedPromoCode = order.promo || ''
  const totals = recalculatePendingOrderTotals(order, null)

  order.subtotal = totals.subtotal
  order.discount = 0
  order.shipping = totals.shipping
  order.total = totals.total
  order.promo = ''
  order.promoApplied = false
  order.paymentTransactionId = ''

  await order.save()

  return {
    success: true,
    order,
    removedPromoCode,
    previous
  }
}

async function updatePendingOrderDeliveryMethod(userId, orderId, payload = {}) {
  const order = await orderRepository.findOne({ _id: orderId, userId, isDeleted: false })
  if (!order) {
    throw new AppError('Khong tim thay don hang', 404)
  }
  if (order.status !== 'pending' || order.paymentStatus !== 'pending') {
    throw new AppError('Chi co the doi phuong thuc nhan/giao cua don pending chua thanh toan', 400)
  }
  if (order.reservationExpiresAt && new Date(order.reservationExpiresAt).getTime() <= Date.now()) {
    throw new AppError('Don hang da het han thanh toan, vui long tao don moi', 400)
  }

  const deliveryMethod = normalizeOrderDeliveryMethod(payload.deliveryMethod)
  if (!deliveryMethod) {
    throw new AppError('Phuong thuc nhan/giao khong hop le', 400)
  }

  const previousSnapshot = buildOrderSnapshot(order)
  const subtotal = calculateItemsSubtotal(order.orderItems)
  const shipping = calculatePendingOrderDeliveryShipping(deliveryMethod, subtotal, payload.shipping)
  const totals = calculateOrderTotals(order.orderItems, order.discount, shipping)

  order.deliveryMethod = deliveryMethod
  order.subtotal = totals.subtotal
  order.shipping = totals.shipping
  order.total = totals.total

  await order.save()

  return {
    success: true,
    order,
    previous: {
      deliveryMethod: previousSnapshot.deliveryMethod,
      shipping: previousSnapshot.shipping,
      total: previousSnapshot.total
    }
  }
}

async function updatePendingOrderPaymentMethod(userId, orderId, paymentMethod) {
  const normalizedPaymentMethod = String(paymentMethod || '').trim().toLowerCase()
  if (!ONLINE_PAYMENT_METHODS.includes(normalizedPaymentMethod)) {
    throw new AppError('Phuong thuc thanh toan khong hop le cho don pending', 400)
  }

  const order = await orderRepository.findOne({ _id: orderId, userId, isDeleted: false })
  if (!order) {
    throw new AppError('Khong tim thay don hang', 404)
  }
  if (order.status !== 'pending' || order.paymentStatus !== 'pending') {
    throw new AppError('Chi co the doi cong thanh toan cua don pending chua thanh toan', 400)
  }
  if (order.reservationExpiresAt && new Date(order.reservationExpiresAt).getTime() <= Date.now()) {
    throw new AppError('Don hang da het han thanh toan, vui long tao don moi', 400)
  }

  const previousPaymentMethod = order.paymentMethod
  order.paymentMethod = normalizedPaymentMethod
  order.paymentTransactionId = ''
  await order.save()

  return {
    success: true,
    order,
    previousPaymentMethod,
    paymentMethodChanged: previousPaymentMethod !== normalizedPaymentMethod
  }
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
    order = await orderRepository.findOne({
      orderCode: cleanOrderCode,
      'contact.phone': cleanPhone,
      isDeleted: false
    }, { lean: true })
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
    notificationsService.createOrderStatusNotification(order)
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
  updateOrderAddress,
  updateOrderContact,
  updatePendingOrderItems,
  applyPromoCodeToPendingOrder,
  removePromoCodeFromPendingOrder,
  updatePendingOrderDeliveryMethod,
  updatePendingOrderPaymentMethod,
  trackOrder,
  restoreOrderStock,
  markOrderPromoUsed,
  expirePendingOnlineOrders,
  ONLINE_PAYMENT_METHODS,
  getPendingOnlineOrderTtlMs
}
