const mongoose = require('mongoose')
const AppError = require('../../utils/AppError')
const productRepository = require('../../repositories/product.repository')
const purchaseReceiptRepository = require('../../repositories/purchaseReceipt.repository')
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
        { path: 'createdBy.by', select: 'fullName email avatarUrl' }
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

async function createPurchaseReceipt(payload = {}, adminId, lang = 'vi') {
  const productId = normalizeText(payload.productId)
  const quantity = Number(payload.quantity)
  const unitCost = Number(payload.unitCost)

  ensureValidObjectId(productId)

  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new AppError('Số lượng nhập phải lớn hơn 0', 400)
  }

  if (!Number.isFinite(unitCost) || unitCost < 0) {
    throw new AppError('Giá nhập không hợp lệ', 400)
  }

  const product = await productRepository.findById(productId)
  if (!product || product.deleted === true) {
    throw new AppError('Không tìm thấy sản phẩm', 404)
  }

  if (product.deliveryType === 'instant_account') {
    throw new AppError('Sản phẩm giao tài khoản ngay cần nhập bằng credential, không nhập kho thủ công', 400)
  }

  const receipt = await purchaseReceiptRepository.create({
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
    supplierName: normalizeText(payload.supplierName),
    note: normalizeText(payload.note),
    createdBy: { by: adminId, at: new Date() }
  })

  const previousStock = Number(product.stock || 0)

  product.stock = previousStock + quantity
  product.costPrice = unitCost
  product.updateBy.push({ by: adminId, at: new Date() })
  await product.save()
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

module.exports = {
  listPurchaseReceipts,
  createPurchaseReceipt
}
