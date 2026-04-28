const mongoose = require('mongoose')
const AppError = require('../../utils/AppError')
const bannerRepository = require('../../repositories/banner.repository')
const { deleteImageFromCloudinary } = require('../../utils/cloudinaryUtils')

const isTruthy = value => value === true || value === 'true' || value === 1 || value === '1'
const isFalsy = value => value === false || value === 'false' || value === 0 || value === '0'

function normalizeBannerTranslations(translations = {}) {
  const en = translations?.en || {}

  return {
    en: {
      title: typeof en.title === 'string' ? en.title.trim() : '',
      link: typeof en.link === 'string' ? en.link.trim() : ''
    }
  }
}

function ensureValidObjectId(id) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError('Invalid banner ID', 400)
  }
}

function parseBoolean(value, fieldName) {
  if (typeof value === 'undefined' || value === '') return undefined
  if (isTruthy(value)) return true
  if (isFalsy(value)) return false
  throw new AppError(`${fieldName} is invalid`, 400)
}

function parseOrder(value, defaultValue = 0) {
  if (typeof value === 'undefined' || value === null || value === '') {
    return defaultValue
  }

  const parsedValue = Number(value)

  if (Number.isNaN(parsedValue)) {
    throw new AppError('Order must be a number', 400)
  }

  return parsedValue
}

function normalizeWriteError(message, error) {
  if (error instanceof AppError) {
    return error
  }

  if (error?.name === 'ValidationError' || error?.name === 'CastError') {
    return new AppError(message, 400)
  }

  return error
}

async function getBannerByIdOrThrow(id) {
  ensureValidObjectId(id)

  const banner = await bannerRepository.findById(id)

  if (!banner) {
    throw new AppError('Banner not found', 404)
  }

  return banner
}

async function listBanners() {
  const banners = await bannerRepository.findAll({}, { sort: { order: 1 } })

  return {
    message: 'Banners fetched successfully',
    data: banners
  }
}

async function createBanner(payload = {}, user = null) {
  if (!payload.title) {
    throw new AppError('Title is required', 400)
  }

  if (!payload.img) {
    throw new AppError('Image is required', 400)
  }

  try {
    const savedBanner = await bannerRepository.create({
      title: payload.title,
      img: payload.img,
      link: payload.link || '',
      translations: normalizeBannerTranslations(payload.translations),
      order: parseOrder(payload.order, 0),
      isActive: parseBoolean(payload.isActive, 'isActive') ?? true,
      createdBy: user?.userId || null
    })

    return {
      message: 'Banner created successfully',
      data: savedBanner
    }
  } catch (error) {
    throw normalizeWriteError('Failed to create banner', error)
  }
}

async function updateBanner(id, payload = {}, user = null) {
  ensureValidObjectId(id)

  const updateData = {}

  if (Object.prototype.hasOwnProperty.call(payload, 'title')) {
    updateData.title = payload.title
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'link')) {
    updateData.link = payload.link
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'translations')) {
    updateData.translations = normalizeBannerTranslations(payload.translations)
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'order')) {
    updateData.order = parseOrder(payload.order)
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'isActive')) {
    updateData.isActive = parseBoolean(payload.isActive, 'isActive')
  }

  if (typeof payload.img === 'string' && payload.img) {
    updateData.img = payload.img
  }

  updateData.updatedAt = new Date()
  updateData.updatedBy = user?.userId || null

  try {
    const updatedBanner = await bannerRepository.updateById(id, updateData)

    if (!updatedBanner) {
      throw new AppError('Banner not found', 404)
    }

    return {
      message: 'Banner updated successfully',
      data: updatedBanner
    }
  } catch (error) {
    throw normalizeWriteError('Failed to update banner', error)
  }
}

async function deleteBanner(id) {
  const banner = await getBannerByIdOrThrow(id)

  if (banner.img) {
    await deleteImageFromCloudinary(banner.img)
  }

  await bannerRepository.deleteById(id)

  return {
    message: 'Banner deleted successfully'
  }
}

module.exports = {
  listBanners,
  createBanner,
  updateBanner,
  deleteBanner
}
