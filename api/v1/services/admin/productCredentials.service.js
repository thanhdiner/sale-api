const mongoose = require('mongoose')
const Product = require('../../models/products.model')
const ProductCredential = require('../../models/productCredential.model')
const AppError = require('../../utils/AppError')
const { encryptCredential, decryptCredential, summarizeCredential } = require('../../utils/digitalCredentialCrypto')
const { syncProductStock } = require('../digitalDelivery.service')

function ensureObjectId(id, message = 'ID không hợp lệ') {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(message, 400)
  }
}

async function ensureInstantProduct(productId) {
  ensureObjectId(productId, 'ID sản phẩm không hợp lệ')
  const product = await Product.findOne({ _id: productId, deleted: false })
  if (!product) throw new AppError('Không tìm thấy sản phẩm', 404)
  if (product.deliveryType !== 'instant_account') {
    throw new AppError('Sản phẩm chưa bật giao tài khoản ngay trên web', 400)
  }
  return product
}

function normalizeCredentialPayload(payload = {}) {
  return {
    username: String(payload.username || payload.userName || payload.login || '').trim(),
    password: String(payload.password || payload.pass || '').trim(),
    email: String(payload.email || payload.loginEmail || '').trim(),
    licenseKey: String(payload.licenseKey || payload.key || payload.activationKey || '').trim(),
    loginUrl: String(payload.loginUrl || payload.url || '').trim(),
    notes: String(payload.notes || payload.instructions || payload.note || '').trim()
  }
}

function sanitizeCredentialPayload(payload = {}) {
  const normalized = normalizeCredentialPayload(payload)
  return Object.fromEntries(Object.entries(normalized).filter(([, value]) => value !== ''))
}

async function listByProduct(productId) {
  await ensureInstantProduct(productId)
  const credentials = await ProductCredential.find({ productId })
    .sort({ status: 1, createdAt: -1 })
    .select('_id productId status summary reservedByOrderId soldToOrderId reservedAt soldAt disabledAt createdAt updatedAt')
    .lean()
  const availableCount = await syncProductStock(productId, { invalidateCache: false, notifyRestock: false })

  return { success: true, credentials, availableCount }
}

async function createMany(productId, credentials = [], adminId) {
  await ensureInstantProduct(productId)

  const payloads = (Array.isArray(credentials) ? credentials : [credentials])
    .map(sanitizeCredentialPayload)
    .filter(payload => Object.keys(payload).length > 0)

  if (!payloads.length) {
    throw new AppError('Vui lòng nhập ít nhất một tài khoản/license', 400)
  }

  const docs = payloads.map(payload => ({
    productId,
    status: 'available',
    credential: encryptCredential(payload),
    summary: summarizeCredential(payload),
    createdBy: { by: adminId, at: new Date() }
  }))

  const inserted = await ProductCredential.insertMany(docs)
  const availableCount = await syncProductStock(productId)

  return { success: true, credentials: inserted, availableCount }
}

async function reveal(credentialId) {
  ensureObjectId(credentialId, 'ID credential không hợp lệ')
  const credential = await ProductCredential.findById(credentialId).lean()
  if (!credential) throw new AppError('Không tìm thấy credential', 404)

  return {
    success: true,
    credential: {
      _id: credential._id,
      productId: credential.productId,
      status: credential.status,
      data: decryptCredential(credential.credential)
    }
  }
}

async function disable(credentialId, adminId) {
  ensureObjectId(credentialId, 'ID credential không hợp lệ')
  const credential = await ProductCredential.findOne({ _id: credentialId })
  if (!credential) throw new AppError('Không tìm thấy credential', 404)
  if (credential.status !== 'available') {
    throw new AppError('Chỉ có thể vô hiệu hóa credential chưa bán/chưa giữ', 400)
  }

  credential.status = 'disabled'
  credential.disabledAt = new Date()
  credential.updatedBy.push({ by: adminId, at: new Date() })
  await credential.save()
  const availableCount = await syncProductStock(credential.productId)

  return { success: true, credential, availableCount }
}

module.exports = {
  syncProductStock,
  listByProduct,
  createMany,
  reveal,
  disable
}
