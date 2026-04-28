const mongoose = require('mongoose')
const flashSaleRepository = require('../../repositories/flashSale.repository')
const AppError = require('../../utils/AppError')

function ensureValidObjectId(id, message = 'ID flash sale khong hop le') {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(message, 400)
  }
}

function normalizeWriteError(error, fallbackMessage) {
  if (error instanceof AppError) {
    return error
  }

  if (error?.name === 'ValidationError' || error?.name === 'CastError') {
    return new AppError(error.message || fallbackMessage, 400)
  }

  return error
}

function normalizeFlashSaleTranslations(translations = {}) {
  const englishName = translations?.en?.name

  return {
    en: {
      name: typeof englishName === 'string' ? englishName.trim() : ''
    }
  }
}

function getRealStatus(flashSale) {
  const now = new Date()

  if (now < flashSale.startAt) return 'scheduled'
  if (now >= flashSale.startAt && now <= flashSale.endAt && flashSale.soldQuantity < flashSale.maxQuantity) {
    return 'active'
  }

  return 'completed'
}

function decorateFlashSaleStatus(flashSale) {
  const data = flashSale?.toObject ? flashSale.toObject() : { ...flashSale }

  return {
    ...data,
    status: getRealStatus(data)
  }
}

async function getFlashSaleByIdOrThrow(id, options = {}) {
  const { populate, message = 'Khong tim thay flash sale' } = options

  ensureValidObjectId(id)

  const flashSale = await flashSaleRepository.findById(id, { populate })

  if (!flashSale) {
    throw new AppError(message, 404)
  }

  return flashSale
}

async function listFlashSales(params = {}) {
  const {
    status,
    name,
    page = 1,
    limit = 20
  } = params

  const pageNum = Math.max(parseInt(page, 10) || 1, 1)
  const limitNum = Math.max(parseInt(limit, 10) || 20, 1)
  const filter = {}

  if (status && status !== 'all') filter.status = status
  if (name) {
    const nameFilter = { $regex: name, $options: 'i' }
    filter.$or = [
      { name: nameFilter },
      { 'translations.en.name': nameFilter }
    ]
  }

  const total = await flashSaleRepository.countByQuery(filter)
  const flashSales = await flashSaleRepository.findByQuery(filter, {
    populate: { path: 'products', select: 'title translations' },
    sort: { createdAt: -1 },
    skip: (pageNum - 1) * limitNum,
    limit: limitNum
  })

  return {
    total,
    flashSales: flashSales.map(decorateFlashSaleStatus)
  }
}

async function getFlashSaleDetail(id) {
  const flashSale = await getFlashSaleByIdOrThrow(id, {
    populate: { path: 'products', select: 'title translations price' }
  })

  return {
    flashSale: decorateFlashSaleStatus(flashSale)
  }
}

async function createFlashSale(payload = {}) {
  const {
    name,
    startAt,
    endAt,
    discountPercent,
    maxQuantity,
    products
  } = payload

  if (!name || !startAt || !endAt || !discountPercent || !maxQuantity || !products || !products.length) {
    throw new AppError('Thieu thong tin bat buoc', 400)
  }

  try {
    const flashSale = await flashSaleRepository.create({
      name,
      translations: normalizeFlashSaleTranslations(payload.translations),
      startAt,
      endAt,
      discountPercent,
      maxQuantity,
      products,
      soldQuantity: 0,
      status: 'scheduled',
      revenue: 0
    })

    return {
      message: 'Tao flash sale thanh cong',
      flashSale
    }
  } catch (error) {
    throw normalizeWriteError(error, 'Tao flash sale that bai')
  }
}

async function updateFlashSale(id, payload = {}) {
  ensureValidObjectId(id)

  const updateFields = {}

  if (payload.name !== undefined) updateFields.name = payload.name
  if (payload.translations !== undefined) updateFields.translations = normalizeFlashSaleTranslations(payload.translations)
  if (payload.startAt !== undefined) updateFields.startAt = payload.startAt
  if (payload.endAt !== undefined) updateFields.endAt = payload.endAt
  if (payload.discountPercent !== undefined) updateFields.discountPercent = payload.discountPercent
  if (payload.maxQuantity !== undefined) updateFields.maxQuantity = payload.maxQuantity
  if (payload.products !== undefined) updateFields.products = payload.products

  try {
    const updatedFlashSale = await flashSaleRepository.updateById(id, updateFields)

    if (!updatedFlashSale) {
      throw new AppError('Khong tim thay flash sale', 404)
    }

    return {
      message: 'Cap nhat thanh cong',
      flashSale: updatedFlashSale
    }
  } catch (error) {
    throw normalizeWriteError(error, 'Cap nhat flash sale that bai')
  }
}

async function deleteFlashSale(id) {
  ensureValidObjectId(id)

  const result = await flashSaleRepository.deleteById(id)

  if (!result) {
    throw new AppError('Khong tim thay flash sale', 404)
  }

  return {
    message: 'Da xoa flash sale thanh cong'
  }
}

async function deleteManyFlashSales(ids = []) {
  if (!Array.isArray(ids) || ids.length === 0) {
    throw new AppError('Can truyen mang ids', 400)
  }

  ids.forEach(id => ensureValidObjectId(id))

  const result = await flashSaleRepository.deleteMany({ _id: { $in: ids } })

  return {
    message: `Da xoa ${result.deletedCount} flash sale`
  }
}

async function changeFlashSaleStatus(id, status) {
  const flashSale = await getFlashSaleByIdOrThrow(id)
  flashSale.status = status

  try {
    await flashSale.save()
  } catch (error) {
    throw normalizeWriteError(error, 'Doi trang thai flash sale that bai')
  }

  return {
    message: 'Doi trang thai thanh cong',
    flashSale
  }
}

async function changeFlashSaleStatusMany(ids = [], status) {
  if (!Array.isArray(ids) || ids.length === 0 || !status) {
    throw new AppError('Can truyen ids va status', 400)
  }

  ids.forEach(id => ensureValidObjectId(id))

  await flashSaleRepository.updateMany({ _id: { $in: ids } }, { status })

  return {
    message: `Da cap nhat trang thai cho ${ids.length} flash sale`
  }
}

async function changeFlashSalePositionMany(items = []) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new AppError('Thieu danh sach items', 400)
  }

  for (const item of items) {
    ensureValidObjectId(item.id)
    await flashSaleRepository.updateById(item.id, { position: item.position })
  }

  return {
    message: 'Cap nhat vi tri thanh cong'
  }
}

module.exports = {
  listFlashSales,
  getFlashSaleDetail,
  createFlashSale,
  updateFlashSale,
  deleteFlashSale,
  deleteManyFlashSales,
  changeFlashSaleStatus,
  changeFlashSaleStatusMany,
  changeFlashSalePositionMany
}
