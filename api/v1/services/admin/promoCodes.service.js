const mongoose = require('mongoose')
const AppError = require('../../utils/AppError')
const promoCodeRepository = require('../../repositories/promoCode.repository')

const PROMO_CODE_USER_POPULATE = [
  { path: 'userId', select: 'fullName username email avatarUrl' },
  { path: 'usedBy', select: 'fullName username email avatarUrl' }
]

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

function buildTextSearch(value) {
  const escapedValue = String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return { $regex: escapedValue, $options: 'i' }
}

function buildPromoStatusQuery(status) {
  const now = new Date()

  if (status === 'disabled') {
    return { isActive: false }
  }

  if (status === 'expired') {
    return { expiresAt: { $lt: now } }
  }

  if (status === 'active') {
    return {
      isActive: true,
      $and: [
        {
          $or: [
            { startsAt: { $exists: false } },
            { startsAt: null },
            { startsAt: { $lte: now } }
          ]
        },
        {
          $or: [
            { expiresAt: { $exists: false } },
            { expiresAt: null },
            { expiresAt: { $gte: now } }
          ]
        }
      ]
    }
  }

  return null
}

function buildPromoDiscountTypeQuery(discountType) {
  if (discountType === 'percent' || discountType === 'percentage') {
    return { discountType: 'percent' }
  }

  if (discountType === 'fixed' || discountType === 'amount') {
    return { discountType: 'amount' }
  }

  if (discountType === 'free_shipping') {
    return { category: 'shipping' }
  }

  return null
}

function buildPromoAudienceQuery(audience) {
  if (audience === 'all_customers') {
    return {
      $and: [
        {
          $or: [
            { audienceType: { $exists: false } },
            { audienceType: null },
            { audienceType: 'all_customers' }
          ]
        },
        {
          $or: [
            { userId: { $exists: false } },
            { userId: null }
          ]
        },
        { category: { $nin: ['new', 'vip', 'student'] } }
      ]
    }
  }

  if (audience === 'new_customers') {
    return {
      $or: [
        { audienceType: 'new_customers' },
        { category: 'new' },
        { newCustomersOnly: true }
      ]
    }
  }

  if (audience === 'specific_customers') {
    return {
      $or: [
        { audienceType: 'specific_customers' },
        { userId: { $ne: null } },
        { 'specificCustomers.0': { $exists: true } }
      ]
    }
  }

  if (audience === 'customer_groups') {
    return {
      $or: [
        { audienceType: 'customer_groups' },
        { 'customerGroups.0': { $exists: true } },
        { category: { $in: ['vip', 'student'] } }
      ]
    }
  }

  return null
}

function buildPromoDateQuery({ dateField, startDate, endDate }) {
  const allowedDateFields = new Set(['expiresAt', 'createdAt'])
  const field = allowedDateFields.has(dateField) ? dateField : null
  const range = {}

  if (!field) return null

  if (startDate) {
    const parsedStart = new Date(startDate)
    if (!Number.isNaN(parsedStart.getTime())) range.$gte = parsedStart
  }

  if (endDate) {
    const parsedEnd = new Date(endDate)
    if (!Number.isNaN(parsedEnd.getTime())) range.$lte = parsedEnd
  }

  return Object.keys(range).length ? { [field]: range } : null
}

function normalizePromoTranslations(translations = {}) {
  const englishTitle = translations?.en?.title
  const englishDescription = translations?.en?.description

  return {
    en: {
      title: typeof englishTitle === 'string' ? englishTitle.trim() : '',
      description: typeof englishDescription === 'string' ? englishDescription : ''
    }
  }
}

function normalizePromoPayload(payload = {}) {
  const data = { ...payload }

  if (typeof data.code === 'string') {
    data.code = data.code.trim().toUpperCase()
  }

  if (Object.prototype.hasOwnProperty.call(data, 'title')) {
    data.title = typeof data.title === 'string' ? data.title.trim() : ''
  }

  if (Object.prototype.hasOwnProperty.call(data, 'description')) {
    data.description = typeof data.description === 'string' ? data.description : ''
  }

  if (Object.prototype.hasOwnProperty.call(data, 'translations')) {
    data.translations = normalizePromoTranslations(data.translations)
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
  const clauses = []
  const query = {}

  if (search) {
    const textSearch = buildTextSearch(search)
    clauses.push({
      $or: [
        { code: textSearch },
        { title: textSearch },
        { 'translations.en.title': textSearch }
      ]
    })
  }

  const statusQuery = buildPromoStatusQuery(params.status)
  const discountTypeQuery = buildPromoDiscountTypeQuery(params.discountType)
  const audienceQuery = buildPromoAudienceQuery(params.audience)
  const dateQuery = buildPromoDateQuery(params)

  if (statusQuery) clauses.push(statusQuery)
  if (discountTypeQuery) clauses.push(discountTypeQuery)
  if (audienceQuery) clauses.push(audienceQuery)
  if (dateQuery) clauses.push(dateQuery)

  if (clauses.length) {
    query.$and = clauses
  }

  const [promoCodes, total] = await Promise.all([
    promoCodeRepository.findAll(query, {
      sort: { createdAt: -1 },
      skip: (pageNum - 1) * limitNum,
      limit: limitNum,
      populate: PROMO_CODE_USER_POPULATE
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

  const promo = await promoCodeRepository.findById(id, {
    populate: PROMO_CODE_USER_POPULATE
  })
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
