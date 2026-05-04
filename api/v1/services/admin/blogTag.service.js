const slugify = require('slugify')
const AppError = require('../../utils/AppError')
const BlogTag = require('../../models/blogTag.model')
const BlogPost = require('../../models/blogPost.model')

const BLOG_TAG_STATUSES = new Set(['active', 'inactive'])

function getAdminId(user = null) {
  return user?.userId || user?.id || user?._id || null
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeStatus(value, fallback = 'active') {
  const status = normalizeText(value || fallback)
  if (!BLOG_TAG_STATUSES.has(status)) throw new AppError('Tag status is invalid', 400)
  return status
}

function buildSlug(value, fallback = '') {
  return slugify(normalizeText(value || fallback), { lower: true, strict: true, locale: 'vi' })
}

function normalizeTranslations(value = {}) {
  const en = value?.en || {}
  const name = normalizeText(en.name).slice(0, 80)
  return {
    en: {
      name,
      slug: buildSlug(en.slug, name).slice(0, 120)
    }
  }
}

function normalizeWriteError(error) {
  if (error instanceof AppError) return error
  if (error?.code === 11000) return new AppError('Tag slug already exists', 400)
  if (error?.name === 'ValidationError' || error?.name === 'CastError') return new AppError(error.message, 400)
  return error
}

function buildTextSearch(value) {
  return { $regex: String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' }
}

async function listTags(params = {}) {
  const keyword = normalizeText(params.keyword || params.search)
  const status = normalizeText(params.status)
  const query = { deleted: false }

  if (status && status !== 'all') query.status = normalizeStatus(status)
  if (keyword) {
    const search = buildTextSearch(keyword)
    query.$or = [{ name: search }, { slug: search }, { 'translations.en.name': search }, { 'translations.en.slug': search }]
  }

  const tags = await BlogTag.find(query).sort({ name: 1 }).lean()
  const counts = await BlogPost.aggregate([
    { $match: { isDeleted: false, tagIds: { $exists: true, $ne: [] } } },
    { $unwind: '$tagIds' },
    { $group: { _id: '$tagIds', count: { $sum: 1 } } }
  ])
  const countMap = new Map(counts.map(item => [String(item._id), item.count]))

  return {
    message: 'Blog tags fetched successfully',
    data: tags.map(tag => ({ ...tag, postsCount: countMap.get(String(tag._id)) || 0 }))
  }
}

async function createTag(payload = {}, user = null) {
  const name = normalizeText(payload.name)
  if (!name) throw new AppError('Tag name is required', 400)

  try {
    const tag = await BlogTag.create({
      name,
      slug: buildSlug(payload.slug, name),
      translations: normalizeTranslations(payload.translations),
      status: normalizeStatus(payload.status),
      createdBy: getAdminId(user)
    })
    return { message: 'Blog tag created successfully', data: tag }
  } catch (error) {
    throw normalizeWriteError(error)
  }
}

async function updateTag(id, payload = {}, user = null) {
  try {
    const tag = await BlogTag.findOne({ _id: id, deleted: false })
    if (!tag) throw new AppError('Blog tag not found', 404)

    if (Object.prototype.hasOwnProperty.call(payload, 'name')) {
      const name = normalizeText(payload.name)
      if (!name) throw new AppError('Tag name is required', 400)
      tag.name = name
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'slug')) tag.slug = buildSlug(payload.slug, tag.name)
    if (Object.prototype.hasOwnProperty.call(payload, 'translations')) tag.translations = normalizeTranslations(payload.translations)
    if (Object.prototype.hasOwnProperty.call(payload, 'status')) tag.status = normalizeStatus(payload.status, tag.status)
    tag.updatedBy = getAdminId(user)

    await tag.save()
    return { message: 'Blog tag updated successfully', data: tag }
  } catch (error) {
    throw normalizeWriteError(error)
  }
}

async function deleteTag(id, user = null) {
  const tag = await BlogTag.findOne({ _id: id, deleted: false })
  if (!tag) throw new AppError('Blog tag not found', 404)
  tag.deleted = true
  tag.status = 'inactive'
  tag.updatedBy = getAdminId(user)
  await tag.save()
  return { message: 'Blog tag deleted successfully', data: tag }
}

async function updateTagStatus(id, status, user = null) {
  const tag = await BlogTag.findOne({ _id: id, deleted: false })
  if (!tag) throw new AppError('Blog tag not found', 404)
  tag.status = normalizeStatus(status, tag.status)
  tag.updatedBy = getAdminId(user)
  await tag.save()
  return { message: 'Blog tag status updated successfully', data: tag }
}

module.exports = { listTags, createTag, updateTag, deleteTag, updateTagStatus }
