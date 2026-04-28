const mongoose = require('mongoose')
const slugify = require('slugify')
const AppError = require('../../utils/AppError')
const BlogPost = require('../../models/blogPost.model')
const blogPostRepository = require('../../repositories/blogPost.repository')
const { deleteImageFromCloudinary } = require('../../utils/cloudinaryUtils')

const BLOG_STATUSES = new Set(['draft', 'published'])

const isTruthy = value => value === true || value === 'true' || value === 1 || value === '1'
const isFalsy = value => value === false || value === 'false' || value === 0 || value === '0'

function ensureValidObjectId(id) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError('Invalid blog post ID', 400)
  }
}

function parseBoolean(value, fieldName) {
  if (typeof value === 'undefined' || value === '') return undefined
  if (isTruthy(value)) return true
  if (isFalsy(value)) return false
  throw new AppError(`${fieldName} is invalid`, 400)
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeLongText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function parseJson(value, fallback) {
  if (typeof value !== 'string') return value

  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

function normalizeTags(value) {
  const parsedValue = parseJson(value, value)
  const tags = Array.isArray(parsedValue)
    ? parsedValue
    : String(parsedValue || '')
      .split(',')

  return Array.from(new Set(
    tags
      .map(tag => normalizeText(tag))
      .filter(Boolean)
  )).slice(0, 12)
}

function normalizeTranslations(translations = {}) {
  const parsedTranslations = parseJson(translations, {})
  const en = parsedTranslations?.en || {}

  return {
    en: {
      title: normalizeText(en.title),
      excerpt: normalizeText(en.excerpt),
      content: normalizeLongText(en.content),
      category: normalizeText(en.category),
      tags: normalizeTags(en.tags)
    }
  }
}

function normalizeStatus(value, fallback = 'draft') {
  const status = normalizeText(value || fallback)
  if (!BLOG_STATUSES.has(status)) {
    throw new AppError('Status is invalid', 400)
  }
  return status
}

function normalizeDate(value) {
  if (typeof value === 'undefined') return undefined
  if (value === null || value === '') return null

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new AppError('Published date is invalid', 400)
  }

  return date
}

function normalizePublishedAt(value, status, fallbackDate = null) {
  const parsedDate = normalizeDate(value)

  if (status === 'published') {
    return parsedDate || fallbackDate || new Date()
  }

  return typeof parsedDate === 'undefined' ? fallbackDate : parsedDate
}

function normalizeWriteError(message, error) {
  if (error instanceof AppError) {
    return error
  }

  if (error?.code === 11000) {
    return new AppError('Slug already exists', 400)
  }

  if (error?.name === 'ValidationError' || error?.name === 'CastError') {
    return new AppError(message, 400, error.message)
  }

  return error
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function buildTextSearch(value) {
  return { $regex: escapeRegex(value), $options: 'i' }
}

async function buildNextSlug(baseSlug, currentId = null) {
  const query = {
    slug: new RegExp(`^${escapeRegex(baseSlug)}(-\\d+)?$`, 'i'),
    isDeleted: false,
    ...(currentId ? { _id: { $ne: currentId } } : {})
  }

  const existingPosts = await BlogPost.find(query).select('slug').lean()
  const suffixes = existingPosts.map(post => {
    const match = String(post.slug || '').match(new RegExp(`^${escapeRegex(baseSlug)}-(\\d+)$`, 'i'))
    return match ? Number(match[1]) : 0
  })

  return `${baseSlug}-${Math.max(...suffixes, 0) + 1}`
}

async function buildUniqueSlug({ title, slugInput, currentId = null }) {
  const hasUserInput = typeof slugInput === 'string' && slugInput.trim().length > 0
  const slugSource = hasUserInput ? slugInput : title
  const baseSlug = slugify(normalizeText(slugSource), {
    lower: true,
    strict: true,
    locale: 'vi'
  }) || `blog-${Date.now()}`

  const existingPost = await blogPostRepository.findOne({
    slug: baseSlug,
    isDeleted: false,
    ...(currentId ? { _id: { $ne: currentId } } : {})
  }, { select: '_id', lean: true })

  if (!existingPost) {
    return baseSlug
  }

  const suggestedSlug = await buildNextSlug(baseSlug, currentId)

  if (hasUserInput) {
    throw new AppError('Slug already exists', 400, { suggestedSlug })
  }

  return suggestedSlug
}

function buildListQuery(params = {}) {
  const query = { isDeleted: false }
  const keyword = normalizeText(params.keyword)
  const status = normalizeText(params.status)
  const category = normalizeText(params.category)
  const featured = parseBoolean(params.isFeatured, 'isFeatured')

  if (status) {
    if (!BLOG_STATUSES.has(status)) {
      throw new AppError('Status is invalid', 400)
    }
    query.status = status
  }

  if (category) {
    const categorySearch = buildTextSearch(category)
    query.$or = [
      { category: categorySearch },
      { 'translations.en.category': categorySearch }
    ]
  }

  if (typeof featured === 'boolean') {
    query.isFeatured = featured
  }

  if (keyword) {
    const textSearch = buildTextSearch(keyword)
    const keywordFilters = [
      { title: textSearch },
      { slug: textSearch },
      { excerpt: textSearch },
      { content: textSearch },
      { category: textSearch },
      { tags: textSearch },
      { 'translations.en.title': textSearch },
      { 'translations.en.excerpt': textSearch },
      { 'translations.en.content': textSearch },
      { 'translations.en.category': textSearch },
      { 'translations.en.tags': textSearch }
    ]

    query.$and = [
      ...(query.$or ? [{ $or: query.$or }] : []),
      { $or: keywordFilters }
    ]
    delete query.$or
  }

  return query
}

async function getBlogPostByIdOrThrow(id, options = {}) {
  ensureValidObjectId(id)

  const post = await blogPostRepository.findById(id, options)
  if (!post || post.isDeleted) {
    throw new AppError('Blog post not found', 404)
  }

  return post
}

async function listBlogPosts(params = {}) {
  const page = Math.max(parseInt(params.page, 10) || 1, 1)
  const limit = Math.min(Math.max(parseInt(params.limit, 10) || 20, 1), 100)
  const query = buildListQuery(params)

  const total = await blogPostRepository.countByQuery(query)
  const posts = await blogPostRepository.findByQuery(query, {
    sort: { isFeatured: -1, publishedAt: -1, updatedAt: -1 },
    skip: (page - 1) * limit,
    limit
  })

  return {
    message: 'Blog posts fetched successfully',
    data: posts,
    total,
    page,
    limit
  }
}

async function getBlogPost(id) {
  return {
    message: 'Blog post fetched successfully',
    data: await getBlogPostByIdOrThrow(id)
  }
}

async function createBlogPost(payload = {}, user = null) {
  const title = normalizeText(payload.title)
  if (!title) {
    throw new AppError('Title is required', 400)
  }

  const status = normalizeStatus(payload.status)

  try {
    const post = await blogPostRepository.create({
      title,
      slug: await buildUniqueSlug({ title, slugInput: payload.slug }),
      excerpt: normalizeText(payload.excerpt),
      content: normalizeLongText(payload.content),
      thumbnail: normalizeText(payload.thumbnail),
      category: normalizeText(payload.category),
      tags: normalizeTags(payload.tags),
      translations: normalizeTranslations(payload.translations),
      status,
      isFeatured: parseBoolean(payload.isFeatured, 'isFeatured') ?? false,
      publishedAt: normalizePublishedAt(payload.publishedAt, status),
      createdBy: user?.userId || user?.id || null
    })

    return {
      message: 'Blog post created successfully',
      data: post
    }
  } catch (error) {
    throw normalizeWriteError('Failed to create blog post', error)
  }
}

async function updateBlogPost(id, payload = {}, user = null) {
  const currentPost = await getBlogPostByIdOrThrow(id)
  const updateData = {}

  if (Object.prototype.hasOwnProperty.call(payload, 'title')) {
    const title = normalizeText(payload.title)
    if (!title) {
      throw new AppError('Title is required', 400)
    }
    updateData.title = title
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'slug')) {
    updateData.slug = await buildUniqueSlug({
      title: updateData.title || currentPost.title,
      slugInput: payload.slug,
      currentId: id
    })
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'excerpt')) updateData.excerpt = normalizeText(payload.excerpt)
  if (Object.prototype.hasOwnProperty.call(payload, 'content')) updateData.content = normalizeLongText(payload.content)
  if (Object.prototype.hasOwnProperty.call(payload, 'thumbnail')) updateData.thumbnail = normalizeText(payload.thumbnail)
  if (Object.prototype.hasOwnProperty.call(payload, 'category')) updateData.category = normalizeText(payload.category)
  if (Object.prototype.hasOwnProperty.call(payload, 'tags')) updateData.tags = normalizeTags(payload.tags)
  if (Object.prototype.hasOwnProperty.call(payload, 'translations')) updateData.translations = normalizeTranslations(payload.translations)
  if (Object.prototype.hasOwnProperty.call(payload, 'isFeatured')) {
    updateData.isFeatured = parseBoolean(payload.isFeatured, 'isFeatured') ?? false
  }

  const nextStatus = Object.prototype.hasOwnProperty.call(payload, 'status')
    ? normalizeStatus(payload.status, currentPost.status)
    : currentPost.status
  updateData.status = nextStatus

  if (Object.prototype.hasOwnProperty.call(payload, 'publishedAt') || Object.prototype.hasOwnProperty.call(payload, 'status')) {
    updateData.publishedAt = normalizePublishedAt(payload.publishedAt, nextStatus, currentPost.publishedAt)
  }

  updateData.updatedBy = user?.userId || user?.id || null
  updateData.updatedAt = new Date()

  try {
    const updatedPost = await blogPostRepository.updateById(id, updateData)

    if (!updatedPost) {
      throw new AppError('Blog post not found', 404)
    }

    return {
      message: 'Blog post updated successfully',
      data: updatedPost
    }
  } catch (error) {
    throw normalizeWriteError('Failed to update blog post', error)
  }
}

async function deleteBlogPost(id) {
  const post = await getBlogPostByIdOrThrow(id)

  if (post.thumbnail) {
    await deleteImageFromCloudinary(post.thumbnail)
  }

  post.isDeleted = true
  post.status = 'draft'
  await post.save()

  return {
    message: 'Blog post deleted successfully'
  }
}

module.exports = {
  listBlogPosts,
  getBlogPost,
  createBlogPost,
  updateBlogPost,
  deleteBlogPost
}
