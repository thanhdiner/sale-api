const AppError = require('../../../utils/AppError')
const BlogCategory = require('../../../models/blog/blogCategory.model')
const handleSlug = require('../../../utils/handleSlug')

function getAdminId(user = null) {
  return user?.userId || user?.id || user?._id || null
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeNumber(value, fallback = 0) {
  if (value === undefined || value === null || value === '') return fallback
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function normalizeBoolean(value, fallback = true) {
  if (value === true || value === 'true' || value === 1 || value === '1') return true
  if (value === false || value === 'false' || value === 0 || value === '0') return false
  return fallback
}

function normalizePositiveInteger(value, fallback, max = 100) {
  const number = Number.parseInt(value, 10)
  if (!Number.isFinite(number) || number < 1) return fallback
  return Math.min(number, max)
}

function buildSort(params = {}) {
  const allowedSortFields = new Set(['name', 'slug', 'sortOrder', 'isActive', 'createdAt', 'updatedAt'])
  const sortField = normalizeText(params.sortField)
  if (!allowedSortFields.has(sortField)) return { sortOrder: 1, name: 1 }

  const sortOrder = normalizeText(params.sortOrder)
  const direction = sortOrder === 'descend' || sortOrder === 'desc' || sortOrder === '-1' ? -1 : 1
  return { [sortField]: direction, _id: 1 }
}

function normalizeSeo(value = {}) {
  const seo = typeof value === 'object' && value ? value : {}
  return {
    title: normalizeText(seo.title).slice(0, 180),
    description: normalizeText(seo.description).slice(0, 300),
    thumbnail: normalizeText(seo.thumbnail).slice(0, 500)
  }
}

function normalizeTranslations(value = {}) {
  const en = value?.en || {}
  return {
    en: {
      name: normalizeText(en.name).slice(0, 120),
      description: normalizeText(en.description).slice(0, 500)
    }
  }
}

async function resolveSlug({ name, slugInput, currentId = null }) {
  const { slug, error, suggestedSlug } = await handleSlug({
    Model: BlogCategory,
    slugInput,
    title: name,
    currentId
  })
  if (error) throw new AppError(error, 400, { suggestedSlug })
  return slug
}

async function getNextSortOrder() {
  const lastCategory = await BlogCategory.findOne({ sortOrder: { $type: 'number' } }).sort({ sortOrder: -1 }).select('sortOrder').lean()
  return normalizeNumber(lastCategory?.sortOrder, 0) + 1
}

async function listCategories(params = {}) {
  const hasPagination = params.page !== undefined || params.limit !== undefined
  const page = normalizePositiveInteger(params.page, 1)
  const limit = normalizePositiveInteger(params.limit, 10)
  const keyword = normalizeText(params.keyword || params.search)
  const query = {}
  if (params.isActive !== undefined && params.isActive !== '' && params.isActive !== 'all') query.isActive = normalizeBoolean(params.isActive)
  if (keyword) query.$or = [
    { name: { $regex: keyword, $options: 'i' } },
    { slug: { $regex: keyword, $options: 'i' } },
    { description: { $regex: keyword, $options: 'i' } },
    { 'translations.en.name': { $regex: keyword, $options: 'i' } },
    { 'translations.en.description': { $regex: keyword, $options: 'i' } }
  ]

  const findQuery = BlogCategory.find(query).sort(buildSort(params))
  if (hasPagination) findQuery.skip((page - 1) * limit).limit(limit)

  const [data, total] = await Promise.all([
    findQuery.lean(),
    BlogCategory.countDocuments(query)
  ])
  return { message: 'Blog categories fetched successfully', data, total, page, limit }
}

async function createCategory(payload = {}, user = null) {
  const name = normalizeText(payload.name)
  if (!name) throw new AppError('Category name is required', 400)

  const category = await BlogCategory.create({
    name,
    slug: await resolveSlug({ name, slugInput: payload.slug }),
    description: normalizeText(payload.description).slice(0, 500),
    thumbnail: normalizeText(payload.thumbnail).slice(0, 500),
    seo: normalizeSeo(payload.seo),
    translations: normalizeTranslations(payload.translations),
    sortOrder: normalizeNumber(payload.sortOrder, await getNextSortOrder()),
    isActive: normalizeBoolean(payload.isActive, true),
    createdBy: getAdminId(user)
  })

  return { message: 'Blog category created successfully', data: category }
}

async function updateCategory(id, payload = {}, user = null) {
  const category = await BlogCategory.findById(id)
  if (!category) throw new AppError('Blog category not found', 404)

  if (Object.prototype.hasOwnProperty.call(payload, 'name')) {
    const name = normalizeText(payload.name)
    if (!name) throw new AppError('Category name is required', 400)
    category.name = name
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'slug')) category.slug = await resolveSlug({
    name: category.name,
    slugInput: payload.slug,
    currentId: id
  })
  if (Object.prototype.hasOwnProperty.call(payload, 'description')) category.description = normalizeText(payload.description).slice(0, 500)
  if (Object.prototype.hasOwnProperty.call(payload, 'thumbnail')) category.thumbnail = normalizeText(payload.thumbnail).slice(0, 500)
  if (Object.prototype.hasOwnProperty.call(payload, 'seo')) category.seo = normalizeSeo(payload.seo)
  if (Object.prototype.hasOwnProperty.call(payload, 'translations')) category.translations = normalizeTranslations(payload.translations)
  if (Object.prototype.hasOwnProperty.call(payload, 'sortOrder')) category.sortOrder = normalizeNumber(payload.sortOrder, category.sortOrder)
  if (Object.prototype.hasOwnProperty.call(payload, 'isActive')) category.isActive = normalizeBoolean(payload.isActive, category.isActive)
  category.updatedBy = getAdminId(user)

  await category.save()
  return { message: 'Blog category updated successfully', data: category }
}

async function deleteCategory(id, user = null) {
  const category = await BlogCategory.findById(id)
  if (!category) throw new AppError('Blog category not found', 404)
  category.isActive = false
  category.updatedBy = getAdminId(user)
  await category.save()
  return { message: 'Blog category disabled successfully', data: category }
}

module.exports = { listCategories, createCategory, updateCategory, deleteCategory }












