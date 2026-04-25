const mongoose = require('mongoose')
const AppError = require('../../utils/AppError')
const promoCodeRepository = require('../../repositories/promoCode.repository')

function ensureValidObjectId(id, message = 'ID promo code khong hop le') {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(message, 400)
  }
}

function normalizeWriteError(error, fallbackMessage) {
  if (error instanceof AppError) {
    return error
  }

  if (error?.code === 11000) {
    return new AppError('Ma giam gia da ton tai', 400)
  }

  if (error?.name === 'ValidationError' || error?.name === 'CastError') {
    return new AppError(error.message || fallbackMessage, 400)
  }

  return error
}

function normalizePromoPayload(payload = {}) {
  const data = { ...payload }

  if (typeof data.code === 'string') {
    data.code = data.code.trim().toUpperCase()
  }

  if (data.discountType === 'fixed') {
    data.discountType = 'amount'
  }

  return data
}

async function listPromoCodes(params = {}) {
  const pageNum = parseInt(params.page, 10) || 1
  const limitNum = parseInt(params.limit, 10) || 20
  const search = String(params.search || '').trim()
  const query = search ? { code: { $regex: search, $options: 'i' } } : {}

  const [promoCodes, total] = await Promise.all([
    promoCodeRepository.findAll(query, {
      sort: { createdAt: -1 },
      skip: (pageNum - 1) * limitNum,
      limit: limitNum
    }),
    promoCodeRepository.countByQuery(query)
  ])

  return { promoCodes, total }
}

async function createPromoCode(payload = {}) {
  const data = normalizePromoPayload(payload)

  try {
    const newPromo = await promoCodeRepository.create(data)
    return { success: true, promoCode: newPromo }
  } catch (error) {
    throw normalizeWriteError(error, 'Khong the tao ma giam gia')
  }
}

async function getPromoCodeById(id) {
  ensureValidObjectId(id)

  const promo = await promoCodeRepository.findById(id)
  if (!promo) {
    throw new AppError('Khong tim thay ma', 404)
  }

  return { promoCode: promo }
}

async function updatePromoCode(id, payload = {}) {
  ensureValidObjectId(id)

  try {
    const promo = await promoCodeRepository.updateById(id, normalizePromoPayload(payload))
    if (!promo) {
      throw new AppError('Khong tim thay ma', 404)
    }

    return { success: true, promoCode: promo }
  } catch (error) {
    throw normalizeWriteError(error, 'Khong the cap nhat ma giam gia')
  }
}

async function deletePromoCode(id) {
  ensureValidObjectId(id)

  const deleted = await promoCodeRepository.deleteById(id)
  if (!deleted) {
    throw new AppError('Khong tim thay ma', 404)
  }

  return { success: true }
}

module.exports = {
  listPromoCodes,
  createPromoCode,
  getPromoCodeById,
  updatePromoCode,
  deletePromoCode
}
