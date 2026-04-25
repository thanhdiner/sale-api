const mongoose = require('mongoose')
const AppError = require('../../utils/AppError')
const widgetRepository = require('../../repositories/widget.repository')
const { deleteImageFromCloudinary } = require('../../utils/cloudinaryUtils')

const isTruthy = value => value === true || value === 'true' || value === 1 || value === '1'
const isFalsy = value => value === false || value === 'false' || value === 0 || value === '0'

function ensureValidObjectId(id) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError('Invalid widget ID', 400)
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

async function getWidgetByIdOrThrow(id) {
  ensureValidObjectId(id)

  const widget = await widgetRepository.findById(id)
  if (!widget) {
    throw new AppError('Widget not found', 404)
  }

  return widget
}

async function listWidgets(params = {}) {
  const { title, isActive, sortField, sortOrder } = params
  const filter = {}
  if (title) filter.title = { $regex: title, $options: 'i' }
  if (typeof isActive !== 'undefined') filter.isActive = parseBoolean(isActive, 'isActive')

  const sort = {}
  if (sortField && sortOrder) sort[sortField] = sortOrder === 'descend' ? -1 : 1
  else sort.order = 1

  const widgets = await widgetRepository.findAll(filter, { sort })

  return {
    message: 'Widgets fetched successfully',
    data: widgets
  }
}

async function createWidget(payload = {}, user = null) {
  const { title, iconUrl, link, order, isActive } = payload

  if (!title || !iconUrl) {
    throw new AppError('Title and iconUrl are required', 400)
  }

  let orderNumber = 0
  if (order !== undefined) {
    orderNumber = parseOrder(order)
  } else {
    const lastWidget = await widgetRepository.findOne({}, { sort: { order: -1 } })
    orderNumber = lastWidget ? lastWidget.order + 1 : 0
  }

  try {
    const savedWidget = await widgetRepository.create({
      title,
      iconUrl,
      link: link || '',
      order: orderNumber,
      isActive: parseBoolean(isActive, 'isActive') ?? true,
      createdBy: user?.userId || null
    })

    return {
      message: 'Widget created successfully',
      data: savedWidget
    }
  } catch (error) {
    throw normalizeWriteError('Failed to create widget', error)
  }
}

async function updateWidget(id, payload = {}, user = null) {
  ensureValidObjectId(id)

  const updateData = {}

  if (Object.prototype.hasOwnProperty.call(payload, 'title')) updateData.title = payload.title
  if (Object.prototype.hasOwnProperty.call(payload, 'iconUrl')) updateData.iconUrl = payload.iconUrl
  if (Object.prototype.hasOwnProperty.call(payload, 'link')) updateData.link = payload.link
  if (Object.prototype.hasOwnProperty.call(payload, 'order')) updateData.order = parseOrder(payload.order)
  if (Object.prototype.hasOwnProperty.call(payload, 'isActive')) {
    updateData.isActive = parseBoolean(payload.isActive, 'isActive')
  }

  updateData.updatedAt = new Date()
  updateData.updatedBy = user?.userId || null

  try {
    const updatedWidget = await widgetRepository.updateById(id, updateData)

    if (!updatedWidget) {
      throw new AppError('Widget not found', 404)
    }

    return {
      message: 'Widget updated successfully',
      data: updatedWidget
    }
  } catch (error) {
    throw normalizeWriteError('Failed to update widget', error)
  }
}

async function deleteWidget(id) {
  const widget = await getWidgetByIdOrThrow(id)

  if (widget.iconUrl) {
    await deleteImageFromCloudinary(widget.iconUrl)
  }

  await widgetRepository.deleteById(id)

  return {
    message: 'Widget deleted successfully'
  }
}

module.exports = {
  listWidgets,
  createWidget,
  updateWidget,
  deleteWidget
}
