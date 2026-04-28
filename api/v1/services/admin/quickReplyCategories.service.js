const mongoose = require('mongoose')
const slugify = require('slugify')
const AppError = require('../../utils/AppError')
const quickReplyCategoryRepository = require('../../repositories/quickReplyCategory.repository')
const quickReplyRepository = require('../../repositories/quickReply.repository')

const DEFAULT_CATEGORY_LIMIT = 200
const HEX_COLOR_PATTERN = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-_]{0,62}$/

const DEFAULT_CATEGORIES = [
  { name: 'Greeting', slug: 'greeting', color: '#5e6ad2', sortOrder: 10 },
  { name: 'Information', slug: 'info', color: '#0f766e', sortOrder: 20 },
  { name: 'Order support', slug: 'order', color: '#2563eb', sortOrder: 30 },
  { name: 'Payment', slug: 'payment', color: '#0891b2', sortOrder: 40 },
  { name: 'Shipping', slug: 'shipping', color: '#0f766e', sortOrder: 50 },
  { name: 'Warranty', slug: 'warranty', color: '#b45309', sortOrder: 60 },
  { name: 'Product', slug: 'product', color: '#7c3aed', sortOrder: 70 },
  { name: 'Closing', slug: 'closing', color: '#16a34a', sortOrder: 80 },
  { name: 'Other', slug: 'other', color: '#64748b', sortOrder: 90 }
]

const isTruthy = value => value === true || value === 'true' || value === 1 || value === '1'
const isFalsy = value => value === false || value === 'false' || value === 0 || value === '0'

function parseBoolean(value, fieldName) {
  if (typeof value === 'undefined' || value === null || value === '') return undefined
  if (isTruthy(value)) return true
  if (isFalsy(value)) return false
  throw new AppError(`${fieldName} is invalid`, 400)
}

function ensureValidObjectId(id, message = 'Invalid quick reply category ID') {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(message, 400)
  }
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeSlug(value, fallback = '') {
  const source = normalizeText(value) || normalizeText(fallback)
  const slug = slugify(source, {
    lower: true,
    locale: 'vi',
    strict: true,
    trim: true
  })

  if (!SLUG_PATTERN.test(slug)) {
    throw new AppError('Slug must use letters, numbers, hyphen, or underscore', 400)
  }

  return slug
}

function normalizeColor(value) {
  const color = normalizeText(value) || '#5e6ad2'

  if (!HEX_COLOR_PATTERN.test(color)) {
    throw new AppError('Color must be a valid hex color', 400)
  }

  return color
}

function normalizeSortOrder(value) {
  if (typeof value === 'undefined' || value === null || value === '') return 0
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : 0
}

function normalizeUser(user = {}) {
  const accountId = user.userId || user.id || user._id || user.accountId
  const name = user.fullName || user.name || user.username || user.email

  if (!accountId && !name) {
    return undefined
  }

  return {
    ...(accountId ? { accountId: String(accountId) } : {}),
    ...(name ? { name: String(name) } : {})
  }
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function buildTextSearch(value) {
  return { $regex: escapeRegex(value), $options: 'i' }
}

async function ensureDefaultCategories() {
  const existingCategories = await quickReplyCategoryRepository.findByQuery(
    { isDeleted: false },
    { limit: DEFAULT_CATEGORY_LIMIT, lean: true }
  )
  const existingSlugs = new Set(existingCategories.map(category => category.slug))
  const missingCategories = DEFAULT_CATEGORIES.filter(category => !existingSlugs.has(category.slug))

  if (missingCategories.length === 0) {
    return
  }

  try {
    await quickReplyCategoryRepository.insertMany(missingCategories.map(category => ({
      ...category,
      isActive: true,
      isDeleted: false
    })))
  } catch (error) {
    if (error?.code !== 11000) {
      throw error
    }
  }
}

function buildListQuery(params = {}) {
  const query = { isDeleted: false }
  const search = normalizeText(params.search || params.keyword)
  const isActive = parseBoolean(params.isActive, 'isActive')

  if (typeof isActive === 'boolean') {
    query.isActive = isActive
  }

  if (search) {
    const textSearch = buildTextSearch(search)
    query.$or = [
      { name: textSearch },
      { slug: textSearch }
    ]
  }

  return query
}

async function getCategoryByIdOrThrow(id) {
  ensureValidObjectId(id)

  const category = await quickReplyCategoryRepository.findByIdNotDeleted(id)
  if (!category) {
    throw new AppError('Quick reply category not found', 404)
  }

  return category
}

async function assertSlugAvailable({ slug, excludeId }) {
  const query = { slug, isDeleted: false }

  if (excludeId) {
    query._id = { $ne: excludeId }
  }

  const existing = await quickReplyCategoryRepository.findOne(query)
  if (existing) {
    throw new AppError('Category slug already exists', 409)
  }
}

function normalizeWritePayload(payload = {}, options = {}) {
  const requireAllFields = options.requireAllFields === true
  const normalized = {}

  if (requireAllFields || Object.prototype.hasOwnProperty.call(payload, 'name')) {
    normalized.name = normalizeText(payload.name)
    if (normalized.name.length < 2) throw new AppError('Category name is required', 400)
  }

  if (requireAllFields || Object.prototype.hasOwnProperty.call(payload, 'slug')) {
    normalized.slug = normalizeSlug(payload.slug, normalized.name || payload.name)
  }

  if (requireAllFields || Object.prototype.hasOwnProperty.call(payload, 'color')) {
    normalized.color = normalizeColor(payload.color)
  }

  if (requireAllFields || Object.prototype.hasOwnProperty.call(payload, 'sortOrder')) {
    normalized.sortOrder = normalizeSortOrder(payload.sortOrder)
  }

  if (requireAllFields || Object.prototype.hasOwnProperty.call(payload, 'isActive')) {
    const activeValue = parseBoolean(payload.isActive, 'isActive')
    if (typeof activeValue === 'boolean') {
      normalized.isActive = activeValue
    } else if (requireAllFields) {
      normalized.isActive = true
    }
  }

  if (requireAllFields && !normalized.slug) {
    normalized.slug = normalizeSlug('', normalized.name)
  }

  return normalized
}

async function listCategories(params = {}) {
  await ensureDefaultCategories()

  const limit = Math.min(Number.parseInt(params.limit, 10) || DEFAULT_CATEGORY_LIMIT, DEFAULT_CATEGORY_LIMIT)
  const query = buildListQuery(params)
  const categories = await quickReplyCategoryRepository.findByQuery(query, {
    sort: { sortOrder: 1, name: 1 },
    limit,
    lean: true
  })

  return { success: true, data: categories }
}

async function createCategory(payload = {}, user = null) {
  const normalized = normalizeWritePayload(payload, { requireAllFields: true })
  await assertSlugAvailable({ slug: normalized.slug })

  try {
    const category = await quickReplyCategoryRepository.create({
      ...normalized,
      createdBy: normalizeUser(user),
      updatedBy: normalizeUser(user)
    })

    return { success: true, data: category }
  } catch (error) {
    if (error?.code === 11000) {
      throw new AppError('Category slug already exists', 409)
    }

    if (error?.name === 'ValidationError') {
      throw new AppError('Invalid category data', 400, error.message)
    }

    throw error
  }
}

async function updateCategory(id, payload = {}, user = null) {
  const category = await getCategoryByIdOrThrow(id)
  const normalized = normalizeWritePayload(payload)

  if (normalized.slug && normalized.slug !== category.slug) {
    await assertSlugAvailable({ slug: normalized.slug, excludeId: id })
  }

  Object.assign(category, normalized, {
    updatedBy: normalizeUser(user)
  })

  try {
    await category.save()
    return { success: true, data: category }
  } catch (error) {
    if (error?.code === 11000) {
      throw new AppError('Category slug already exists', 409)
    }

    if (error?.name === 'ValidationError') {
      throw new AppError('Invalid category data', 400, error.message)
    }

    throw error
  }
}

async function deleteCategory(id, user = null) {
  const category = await getCategoryByIdOrThrow(id)
  const usedCount = await quickReplyRepository.countByQuery({
    category: category.slug,
    isDeleted: false
  })

  if (usedCount > 0) {
    category.isActive = false
    category.updatedBy = normalizeUser(user)
    await category.save()

    return { success: true, softDisabled: true, data: category }
  }

  await quickReplyCategoryRepository.deleteById(id)
  return { success: true, deleted: true }
}

module.exports = {
  createCategory,
  deleteCategory,
  listCategories,
  updateCategory
}
