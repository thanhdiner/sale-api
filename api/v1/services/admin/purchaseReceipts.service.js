const mongoose = require('mongoose')
const AppError = require('../../utils/AppError')
const productRepository = require('../../repositories/product.repository')
const purchaseReceiptRepository = require('../../repositories/purchaseReceipt.repository')
const { invalidateProductCaches } = require('../digitalDelivery.service')

function ensureValidObjectId(id, message = 'ID sản phẩm không hợp lệ') {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(message, 400)
  }
}

function normalizeText(value) {
  return String(value || '').trim()
}

async function listPurchaseReceipts(params = {}) {
  const pageNum = parseInt(params.page, 10) || 1
  const limitNum = parseInt(params.limit, 10) || 20
  const keyword = normalizeText(params.keyword)
  const query = keyword ? { productName: { $regex: keyword, $options: 'i' } } : {}

  const [receipts, total] = await Promise.all([
    purchaseReceiptRepository.findByQuery(query, {
      sort: { createdAt: -1 },
      skip: (pageNum - 1) * limitNum,
      limit: limitNum,
      populate: [
        { path: 'productId', select: 'title stock costPrice deliveryType' },
        { path: 'createdBy.by', select: 'fullName email avatarUrl' }
      ],
      lean: true
    }),
    purchaseReceiptRepository.countByQuery(query)
  ])

  return { success: true, receipts, total }
}

async function createPurchaseReceipt(payload = {}, adminId) {
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
    quantity,
    unitCost,
    totalCost: quantity * unitCost,
    supplierName: normalizeText(payload.supplierName),
    note: normalizeText(payload.note),
    createdBy: { by: adminId, at: new Date() }
  })

  product.stock = Number(product.stock || 0) + quantity
  product.costPrice = unitCost
  product.updateBy.push({ by: adminId, at: new Date() })
  await product.save()
  invalidateProductCaches()

  return { success: true, receipt, product }
}

module.exports = {
  listPurchaseReceipts,
  createPurchaseReceipt
}
