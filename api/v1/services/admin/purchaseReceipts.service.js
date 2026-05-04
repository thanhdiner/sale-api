const mongoose = require('mongoose')
const AppError = require('../../utils/AppError')
const Product = require('../../models/products.model')
const productRepository = require('../../repositories/product.repository')
const purchaseReceiptRepository = require('../../repositories/purchaseReceipt.repository')
const { hasPermission, isSuperAdmin } = require('../../middlewares/admin/checkPermission.middleware')
const { invalidateProductCaches } = require('../digitalDelivery.service')
const { notifyBackInStockForProduct } = require('../backInStock.service')

function ensureValidObjectId(id, message = 'ID sản phẩm không hợp lệ') {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(message, 400)
  }
}

function normalizeText(value) {
  return String(value || '').trim()
}

function normalizeLanguage(lang) {
  return String(lang || '').toLowerCase().startsWith('en') ? 'en' : 'vi'
}

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function firstText(...values) {
  const value = values.find(hasText)
  return value || ''
}

function toPlainObject(item) {
  if (!item) return item
  return item.toObject ? item.toObject() : { ...item }
}

function buildTextSearch(value) {
  const escapedValue = String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return { $regex: escapedValue, $options: 'i' }
}

const RECEIPT_STATUSES = ['active', 'cancelled', 'adjusted']

function buildDateBoundary(value, boundary = 'start') {
  if (!value) return null

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null

  if (boundary === 'end') {
    date.setHours(23, 59, 59, 999)
  } else {
    date.setHours(0, 0, 0, 0)
  }

  return date
}

function getEnglishProductTitle(product) {
  return normalizeText(product?.translations?.en?.title)
}

function getReceiptDisplayProductName(receipt, lang) {
  if (normalizeLanguage(lang) === 'en') {
    const populatedProduct = receipt?.productId && typeof receipt.productId === 'object' ? receipt.productId : null

    return firstText(
      receipt?.translations?.en?.productName,
      populatedProduct?.translations?.en?.title,
      receipt?.productName
    )
  }

  return firstText(receipt?.productName, receipt?.productId?.title)
}

function localizeProduct(product, lang) {
  if (!product || typeof product !== 'object' || !('title' in product)) return product

  const localizedProduct = toPlainObject(product)
  const translatedTitle = normalizeLanguage(lang) === 'en' ? localizedProduct.translations?.en?.title : ''

  if (hasText(translatedTitle)) {
    localizedProduct.title = translatedTitle
  }

  return localizedProduct
}

function localizePurchaseReceipt(receipt, lang) {
  const localizedReceipt = toPlainObject(receipt)

  return {
    ...localizedReceipt,
    displayProductName: getReceiptDisplayProductName(localizedReceipt, lang),
    productId: localizeProduct(localizedReceipt.productId, lang)
  }
}

async function buildKeywordQuery(keyword) {
  if (!keyword) return null

  const textSearch = buildTextSearch(keyword)
  const matchingProducts = await productRepository.findByQuery(
    {
      $or: [
        { title: textSearch },
        { 'translations.en.title': textSearch }
      ]
    },
    {
      select: '_id',
      lean: true
    }
  )
  const productIds = matchingProducts.map(product => product._id).filter(Boolean)
  const conditions = [
    { productName: textSearch },
    { 'translations.en.productName': textSearch }
  ]

  if (productIds.length > 0) {
    conditions.push({ productId: { $in: productIds } })
  }

  return { $or: conditions }
}

async function buildReceiptQuery(params = {}) {
  const keyword = normalizeText(params.keyword)
  const productId = normalizeText(params.productId)
  const supplierName = normalizeText(params.supplierName)
  const status = normalizeText(params.status)
  const dateFrom = buildDateBoundary(params.dateFrom, 'start')
  const dateTo = buildDateBoundary(params.dateTo, 'end')
  const conditions = []

  if (keyword) {
    const keywordQuery = await buildKeywordQuery(keyword)
    if (keywordQuery) conditions.push(keywordQuery)
  }

  if (productId) {
    ensureValidObjectId(productId)
    conditions.push({ productId: new mongoose.Types.ObjectId(productId) })
  }

  if (supplierName) {
    conditions.push({ supplierName: buildTextSearch(supplierName) })
  }

  if (status) {
    if (!RECEIPT_STATUSES.includes(status)) {
      throw new AppError('Trạng thái phiếu nhập không hợp lệ', 400)
    }
    conditions.push({ status })
  }

  if (dateFrom || dateTo) {
    const createdAt = {}
    if (dateFrom) createdAt.$gte = dateFrom
    if (dateTo) createdAt.$lte = dateTo
    conditions.push({ createdAt })
  }

  if (conditions.length === 0) return {}
  if (conditions.length === 1) return conditions[0]

  return { $and: conditions }
}

async function listPurchaseReceipts(params = {}, lang = 'vi') {
  const pageNum = parseInt(params.page, 10) || 1
  const limitNum = parseInt(params.limit, 10) || 20
  const query = await buildReceiptQuery(params)

  const [receipts, total] = await Promise.all([
    purchaseReceiptRepository.findByQuery(query, {
      sort: { createdAt: -1 },
      skip: (pageNum - 1) * limitNum,
      limit: limitNum,
      populate: [
        { path: 'productId', select: 'title translations stock costPrice deliveryType' },
        { path: 'createdBy.by', select: 'fullName email avatarUrl' },
        { path: 'cancelledBy.by', select: 'fullName email avatarUrl' },
        { path: 'updatedBy.by', select: 'fullName email avatarUrl' }
      ],
      lean: true
    }),
    purchaseReceiptRepository.countByQuery(query)
  ])

  return {
    success: true,
    receipts: receipts.map(receipt => localizePurchaseReceipt(receipt, lang)),
    total
  }
}

function validateReceiptInput(productId, quantity, unitCost) {
  ensureValidObjectId(productId)

  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new AppError('Số lượng nhập phải lớn hơn 0', 400)
  }

  if (!Number.isFinite(unitCost) || unitCost < 0) {
    throw new AppError('Giá nhập không hợp lệ', 400)
  }
}

async function createPurchaseReceipt(payload = {}, adminId, lang = 'vi') {
  const productId = normalizeText(payload.productId)
  const quantity = Number(payload.quantity)
  const unitCost = Number(payload.unitCost)
  const now = new Date()
  const session = await mongoose.startSession()
  let receipt
  let product
  let previousStock = 0

  validateReceiptInput(productId, quantity, unitCost)

  try {
    await session.withTransaction(async () => {
      product = await Product.findOne({ _id: productId, deleted: { $ne: true } }).session(session)
      if (!product) {
        throw new AppError('Không tìm thấy sản phẩm', 404)
      }

      if (product.deliveryType !== 'manual') {
        throw new AppError('Chỉ sản phẩm giao thủ công mới được nhập kho thủ công', 400)
      }

      previousStock = Number(product.stock || 0)
      receipt = await purchaseReceiptRepository.create({
        productId: product._id,
        productName: product.title,
        translations: {
          en: {
            productName: getEnglishProductTitle(product)
          }
        },
        quantity,
        unitCost,
        totalCost: quantity * unitCost,
        status: 'active',
        supplierName: normalizeText(payload.supplierName),
        note: normalizeText(payload.note),
        createdBy: { by: adminId, at: now },
        updatedBy: [
          {
            by: adminId,
            at: now,
            action: 'create',
            before: { stock: previousStock },
            after: { stock: previousStock + quantity }
          }
        ]
      }, { session })

      const updateResult = await Product.updateOne(
        { _id: product._id, deleted: { $ne: true } },
        {
          $inc: { stock: quantity },
          $set: { costPrice: unitCost },
          $push: { updateBy: { by: adminId, at: now } }
        },
        { session }
      )

      if (updateResult.matchedCount !== 1) {
        throw new AppError('Không thể cập nhật tồn kho sản phẩm', 400)
      }

      product = await Product.findById(product._id).session(session)
    })
  } finally {
    await session.endSession()
  }

  invalidateProductCaches()

  if (previousStock <= 0 && Number(product.stock || 0) > 0) {
    await notifyBackInStockForProduct(product._id)
  }

  return {
    success: true,
    receipt: localizePurchaseReceipt(receipt, lang),
    product: localizeProduct(product, lang)
  }
}

function canOverrideNegativeStock(user) {
  return isSuperAdmin(user) || hasPermission(user, 'manage_products')
}

async function cancelPurchaseReceipt(id, payload = {}, user = {}, lang = 'vi') {
  ensureValidObjectId(id, 'ID phiếu nhập không hợp lệ')

  const reason = normalizeText(payload.cancelReason || payload.reason)
  const overrideNegativeStock = payload.overrideNegativeStock === true
  const adminId = user?.userId
  const now = new Date()
  const session = await mongoose.startSession()
  let receipt
  let product
  let previousStock = 0
  let nextStock = 0

  if (!reason) {
    throw new AppError('Vui lòng nhập lý do hủy phiếu nhập', 400)
  }

  if (overrideNegativeStock && !canOverrideNegativeStock(user)) {
    throw new AppError('Bạn không có quyền cho phép tồn kho âm', 403)
  }

  try {
    await session.withTransaction(async () => {
      receipt = await purchaseReceiptRepository.findById(id, { session })
      if (!receipt) {
        throw new AppError('Không tìm thấy phiếu nhập', 404)
      }

      if (receipt.status !== 'active') {
        throw new AppError('Phiếu nhập đã bị hủy hoặc không còn hiệu lực', 400)
      }

      product = await Product.findOne({ _id: receipt.productId, deleted: { $ne: true } }).session(session)
      if (!product) {
        throw new AppError('Không tìm thấy sản phẩm', 404)
      }

      previousStock = Number(product.stock || 0)
      nextStock = previousStock - Number(receipt.quantity || 0)

      const productFilter = { _id: product._id, deleted: { $ne: true } }
      if (!overrideNegativeStock) {
        productFilter.stock = { $gte: receipt.quantity }
      }

      const productUpdateResult = await Product.updateOne(
        productFilter,
        {
          $inc: { stock: -receipt.quantity },
          $push: { updateBy: { by: adminId, at: now } }
        },
        { session }
      )

      if (productUpdateResult.matchedCount !== 1) {
        throw new AppError('Không thể hủy vì tồn kho rollback sẽ bị âm', 400)
      }

      receipt = await purchaseReceiptRepository.findOneAndUpdate(
        { _id: receipt._id, status: 'active' },
        {
          $set: {
            status: 'cancelled',
            cancelledBy: { by: adminId, at: now, reason }
          },
          $push: {
            updatedBy: {
              by: adminId,
              at: now,
              action: 'cancel',
              before: { status: 'active', stock: previousStock },
              after: { status: 'cancelled', stock: nextStock }
            }
          }
        },
        { session }
      )

      if (!receipt) {
        throw new AppError('Phiếu nhập đã bị hủy hoặc không còn hiệu lực', 400)
      }

      product = await Product.findById(product._id).session(session)
    })
  } finally {
    await session.endSession()
  }

  invalidateProductCaches()

  return {
    success: true,
    receipt: localizePurchaseReceipt(receipt, lang),
    product: localizeProduct(product, lang)
  }
}

module.exports = {
  listPurchaseReceipts,
  createPurchaseReceipt,
  cancelPurchaseReceipt
}
