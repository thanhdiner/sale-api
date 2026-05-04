const mongoose = require('mongoose')
const slugify = require('slugify')
const AppError = require('../../utils/AppError')
const BlogPost = require('../../models/blogPost.model')
const BlogCategory = require('../../models/blogCategory.model')
const BlogTag = require('../../models/blogTag.model')
const blogPostRepository = require('../../repositories/blogPost.repository')
const { deleteImageFromCloudinary } = require('../../utils/cloudinaryUtils')
const { createRevision } = require('./cmsRevision.service')

const BLOG_STATUSES = new Set(['draft', 'queued', 'published', 'archived'])
const BLOG_REVIEW_STATUSES = new Set(['pending', 'approved', 'rejected', 'needs_edit'])
const BLOG_SOURCES = new Set(['manual', 'ai'])
const DUPLICATE_RISKS = new Set(['low', 'medium', 'high'])
const BLOG_LIST_SORTS = {
  newest: { createdAt: -1 },
  updated: { updatedAt: -1 },
  views: { viewsCount: -1 },
  published: { publishedAt: -1 },
  title: { title: 1 }
}

const isTruthy = value => value === true || value === 'true' || value === 1 || value === '1'
const isFalsy = value => value === false || value === 'false' || value === 0 || value === '0'
const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj || {}, key)

function getAdminId(user = null) {
  return user?.userId || user?.id || user?._id || null
}

function ensureValidObjectId(id, fieldName = 'Blog post ID') {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(`Invalid ${fieldName}`, 400)
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

function normalizeNumber(value, fallback = 0) {
  if (value === undefined || value === null || value === '') return fallback
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
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
    : (typeof parsedValue === 'string' || typeof parsedValue === 'number'
        ? String(parsedValue || '').split(',')
        : [])

  return Array.from(new Set(
    tags
      .map(tag => normalizeText(tag))
      .filter(Boolean)
  )).slice(0, 24)
}

function normalizeObjectIdArray(value, fieldName) {
  const parsedValue = parseJson(value, value)
  const ids = Array.isArray(parsedValue)
    ? parsedValue
    : (typeof parsedValue === 'string' || typeof parsedValue === 'number'
        ? String(parsedValue || '').split(',')
        : [])

  return Array.from(new Set(
    ids
      .map(item => typeof item === 'object' && item ? item._id : item)
      .map(item => normalizeText(item))
      .filter(Boolean)
  )).map(id => {
    ensureValidObjectId(id, fieldName)
    return id
  })
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
      tags: normalizeTags(en.tags),
      seoTitle: normalizeText(en.seoTitle),
      seoDescription: normalizeText(en.seoDescription)
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

function normalizeReviewStatus(value, fallback = 'pending') {
  const reviewStatus = normalizeText(value || fallback)
  if (!BLOG_REVIEW_STATUSES.has(reviewStatus)) {
    throw new AppError('Review status is invalid', 400)
  }
  return reviewStatus
}

function normalizeSource(value, fallback = 'manual') {
  const source = normalizeText(value || fallback)
  if (!BLOG_SOURCES.has(source)) {
    throw new AppError('Source is invalid', 400)
  }
  return source
}

function normalizeDuplicateRisk(value, fallback = 'low') {
  const duplicateRisk = normalizeText(value || fallback)
  if (!DUPLICATE_RISKS.has(duplicateRisk)) {
    throw new AppError('Duplicate risk is invalid', 400)
  }
  return duplicateRisk
}

function normalizeDate(value, fieldName = 'Date') {
  if (typeof value === 'undefined') return undefined
  if (value === null || value === '') return null

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new AppError(`${fieldName} is invalid`, 400)
  }

  return date
}

function normalizePublishedAt(value, status, fallbackDate = null) {
  const parsedDate = normalizeDate(value, 'Published date')

  if (status === 'published') {
    return parsedDate || fallbackDate || new Date()
  }

  return typeof parsedDate === 'undefined' ? null : parsedDate
}

function normalizeSeo(payload = {}, title = '', excerpt = '', currentSeo = {}) {
  const parsedSeo = parseJson(payload.seo, payload.seo) || {}
  const keywordsInput = hasOwn(payload, 'seoKeywords') ? payload.seoKeywords : parsedSeo.keywords

  return {
    title: normalizeText(parsedSeo.title || payload.seoTitle || currentSeo.title || title),
    description: normalizeText(parsedSeo.description || payload.seoDescription || currentSeo.description || excerpt),
    keywords: normalizeTags(keywordsInput || currentSeo.keywords || []),
    canonicalUrl: normalizeText(parsedSeo.canonicalUrl || payload.canonicalUrl || currentSeo.canonicalUrl)
  }
}

function normalizeAutoPublish(payload = {}, currentAutoPublish = {}) {
  const parsedAutoPublish = parseJson(payload.autoPublish, payload.autoPublish) || {}
  const current = currentAutoPublish?.toObject ? currentAutoPublish.toObject() : currentAutoPublish
  const source = {
    ...current,
    ...parsedAutoPublish
  }

  if (hasOwn(payload, 'autoPublishEnabled')) {
    source.enabled = payload.autoPublishEnabled
  }

  if (hasOwn(payload, 'priority')) {
    source.priority = payload.priority
  }

  return {
    enabled: parseBoolean(source.enabled, 'autoPublish.enabled') ?? false,
    priority: normalizeNumber(source.priority, 0),
    publishAfter: normalizeDate(source.publishAfter, 'Publish after') ?? null,
    publishBefore: normalizeDate(source.publishBefore, 'Publish before') ?? null,
    approvedAt: normalizeDate(source.approvedAt, 'Approved date') ?? null,
    approvedBy: source.approvedBy || null,
    scheduleGroup: normalizeText(source.scheduleGroup) || 'default'
  }
}

function normalizeAi(payload = {}, currentAi = {}) {
  const parsedAi = parseJson(payload.ai, payload.ai) || {}
  const current = currentAi?.toObject ? currentAi.toObject() : currentAi
  const generatedByAI = hasOwn(parsedAi, 'generatedByAI')
    ? parseBoolean(parsedAi.generatedByAI, 'ai.generatedByAI')
    : (current.generatedByAI ?? false)

  return {
    generatedByAI: generatedByAI ?? false,
    batchId: normalizeText(parsedAi.batchId || current.batchId),
    topic: normalizeText(parsedAi.topic || current.topic),
    prompt: normalizeLongText(parsedAi.prompt || current.prompt),
    provider: normalizeText(parsedAi.provider || current.provider),
    model: normalizeText(parsedAi.model || current.model),
    qualityScore: normalizeNumber(parsedAi.qualityScore, current.qualityScore || 0),
    duplicateRisk: normalizeDuplicateRisk(parsedAi.duplicateRisk, current.duplicateRisk || 'low'),
    factCheckStatus: normalizeText(parsedAi.factCheckStatus || current.factCheckStatus || 'pending'),
    generatedAt: normalizeDate(parsedAi.generatedAt, 'Generated date') || current.generatedAt || null
  }
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

function appendAndFilter(query, filter) {
  query.$and = [...(query.$and || []), filter]
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

async function resolveTags({ tagIds, tags }) {
  const ids = normalizeObjectIdArray(tagIds, 'tagIds')
  if (ids.length > 0) return BlogTag.find({ _id: { $in: ids }, deleted: false, status: 'active' }).select('_id name slug translations').lean()

  const tagNames = normalizeTags(tags)
  if (tagNames.length === 0) return []

  return BlogTag.find({
    deleted: false,
    status: 'active',
    $or: [
      { name: { $in: tagNames } },
      { slug: { $in: tagNames } },
      { 'translations.en.name': { $in: tagNames } },
      { 'translations.en.slug': { $in: tagNames } }
    ]
  }).select('_id name slug translations').lean()
}

async function resolveCategory({ categorySlug, categoryRef, categoryName }) {
  const ref = normalizeText(categoryRef)
  if (ref) {
    ensureValidObjectId(ref, 'categoryRef')
    const category = await BlogCategory.findOne({ _id: ref, isActive: true }).select('_id name slug').lean()
    if (category) return category
  }

  const slug = normalizeText(categorySlug)
  if (slug) {
    const category = await BlogCategory.findOne({ slug, isActive: true }).select('_id name slug').lean()
    if (category) return category
  }

  const name = normalizeText(categoryName)
  if (name) {
    return BlogCategory.findOne({
      isActive: true,
      $or: [
        { name },
        { slug: name },
        { 'translations.en.name': name }
      ]
    }).select('_id name slug').lean()
  }

  return null
}

async function buildListQuery(params = {}) {
  const query = { isDeleted: false }
  const keyword = normalizeText(params.keyword || params.search)
  const status = normalizeText(params.status)
  const reviewStatus = normalizeText(params.reviewStatus)
  const source = normalizeText(params.source)
  const category = normalizeText(params.category)
  const tag = normalizeText(params.tag)
  const duplicateRisk = normalizeText(params.duplicateRisk)
  const featured = parseBoolean(params.isFeatured, 'isFeatured')
  const missingTranslation = parseBoolean(params.missingTranslation, 'missingTranslation')

  if (status && status !== 'all') {
    if (!BLOG_STATUSES.has(status)) {
      throw new AppError('Status is invalid', 400)
    }
    query.status = status
  }

  if (reviewStatus && reviewStatus !== 'all') {
    if (!BLOG_REVIEW_STATUSES.has(reviewStatus)) {
      throw new AppError('Review status is invalid', 400)
    }
    query.reviewStatus = reviewStatus
  }

  if (source && source !== 'all') {
    if (!BLOG_SOURCES.has(source)) {
      throw new AppError('Source is invalid', 400)
    }
    query.source = source
  }

  if (duplicateRisk && duplicateRisk !== 'all') {
    if (!DUPLICATE_RISKS.has(duplicateRisk)) {
      throw new AppError('Duplicate risk is invalid', 400)
    }
    query['ai.duplicateRisk'] = duplicateRisk
  }

  if (category) {
    const categorySearch = buildTextSearch(category)
    appendAndFilter(query, {
      $or: [
        { category: categorySearch },
        { 'translations.en.category': categorySearch }
      ]
    })
  }

  if (tag) {
    const tagDoc = mongoose.Types.ObjectId.isValid(tag)
      ? await BlogTag.findOne({ _id: tag, deleted: false }).select('_id').lean()
      : await BlogTag.findOne({
        deleted: false,
        $or: [
          { slug: tag },
          { name: buildTextSearch(tag) },
          { 'translations.en.name': buildTextSearch(tag) },
          { 'translations.en.slug': tag }
        ]
      }).select('_id').lean()

    appendAndFilter(query, {
      $or: [
        ...(tagDoc?._id ? [{ tagIds: tagDoc._id }] : []),
        { tags: tag },
        { 'translations.en.tags': tag }
      ]
    })
  }

  if (typeof featured === 'boolean') {
    query.isFeatured = featured
  }

  if (missingTranslation === true) {
    appendAndFilter(query, {
      $or: [
        { 'translations.en.title': { $in: [null, ''] } },
        { 'translations.en.content': { $in: [null, ''] } },
        { 'translations.en.seoTitle': { $in: [null, ''] } },
        { 'translations.en.seoDescription': { $in: [null, ''] } }
      ]
    })
  }

  if (keyword) {
    const textSearch = buildTextSearch(keyword)
    appendAndFilter(query, {
      $or: [
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
        { 'translations.en.tags': textSearch },
        { 'seo.title': textSearch },
        { 'seo.description': textSearch },
        { 'seo.keywords': textSearch },
        { 'ai.topic': textSearch },
        { 'ai.batchId': textSearch }
      ]
    })
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
  const query = await buildListQuery(params)
  const sort = BLOG_LIST_SORTS[normalizeText(params.sort)] || { isFeatured: -1, publishedAt: -1, scheduledAt: 1, updatedAt: -1 }

  const total = await blogPostRepository.countByQuery(query)
  const posts = await blogPostRepository.findByQuery(query, {
    sort,
    skip: (page - 1) * limit,
    limit,
    populate: [
      { path: 'categoryRef', select: 'name slug translations' },
      { path: 'tagIds', select: 'name slug translations status' }
    ]
  })

  return {
    message: 'Blog posts fetched successfully',
    data: posts,
    total,
    page,
    limit
  }
}

async function listPublishQueue(params = {}) {
  const page = Math.max(parseInt(params.page, 10) || 1, 1)
  const limit = Math.min(Math.max(parseInt(params.limit, 10) || 20, 1), 100)
  const query = {
    ...buildListQuery(params),
    status: 'queued',
    reviewStatus: 'approved',
    'autoPublish.enabled': true
  }

  const total = await blogPostRepository.countByQuery(query)
  const posts = await blogPostRepository.findByQuery(query, {
    sort: {
      scheduledAt: 1,
      'autoPublish.priority': -1,
      'autoPublish.approvedAt': 1,
      'ai.qualityScore': -1
    },
    skip: (page - 1) * limit,
    limit
  })

  return {
    message: 'Blog publish queue fetched successfully',
    data: posts,
    total,
    page,
    limit
  }
}

async function getBlogPost(id) {
  return {
    message: 'Blog post fetched successfully',
    data: await getBlogPostByIdOrThrow(id, {
      populate: [
        { path: 'categoryRef', select: 'name slug translations' },
        { path: 'tagIds', select: 'name slug translations status' }
      ]
    })
  }
}

async function previewBlogPost(id) {
  return {
    message: 'Blog post preview fetched successfully',
    data: await getBlogPostByIdOrThrow(id)
  }
}

async function createBlogPost(payload = {}, user = null) {
  const title = normalizeText(payload.title)
  if (!title) {
    throw new AppError('Title is required', 400)
  }

  const status = normalizeStatus(payload.status)
  const source = normalizeSource(payload.source, 'manual')
  const reviewStatus = normalizeReviewStatus(
    payload.reviewStatus,
    status === 'published' ? 'approved' : 'pending'
  )
  const excerpt = normalizeText(payload.excerpt)
  const category = await resolveCategory({
    categorySlug: payload.categorySlug,
    categoryRef: payload.categoryRef,
    categoryName: payload.category
  })
  const categoryName = normalizeText(payload.category) || category?.name || ''
  const resolvedTags = await resolveTags({ tagIds: payload.tagIds, tags: payload.tags })
  const tagNames = resolvedTags.length > 0 ? resolvedTags.map(tag => tag.name) : normalizeTags(payload.tags)

  try {
    const post = await blogPostRepository.create({
      title,
      slug: await buildUniqueSlug({ title, slugInput: payload.slug }),
      excerpt,
      content: normalizeLongText(payload.content),
      thumbnail: normalizeText(payload.thumbnail),
      category: categoryName,
      categoryRef: category?._id || null,
      tags: tagNames,
      tagIds: resolvedTags.map(tag => tag._id),
      relatedProducts: normalizeObjectIdArray(payload.relatedProducts || payload.relatedProductIds, 'relatedProducts'),
      translations: normalizeTranslations(payload.translations),
      seo: normalizeSeo(payload, title, excerpt),
      source,
      status,
      reviewStatus,
      autoPublish: normalizeAutoPublish(payload),
      ai: normalizeAi(payload, { generatedByAI: source === 'ai' }),
      isFeatured: parseBoolean(payload.isFeatured, 'isFeatured') ?? false,
      scheduledAt: normalizeDate(payload.scheduledAt, 'Scheduled date') || null,
      publishedAt: normalizePublishedAt(payload.publishedAt, status),
      publishedBy: status === 'published' ? getAdminId(user) : null,
      createdBy: getAdminId(user)
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

  if (hasOwn(payload, 'title')) {
    const title = normalizeText(payload.title)
    if (!title) {
      throw new AppError('Title is required', 400)
    }
    updateData.title = title
  }

  if (hasOwn(payload, 'slug')) {
    updateData.slug = await buildUniqueSlug({
      title: updateData.title || currentPost.title,
      slugInput: payload.slug,
      currentId: id
    })
  }

  if (hasOwn(payload, 'excerpt')) updateData.excerpt = normalizeText(payload.excerpt)
  if (hasOwn(payload, 'content')) updateData.content = normalizeLongText(payload.content)
  if (hasOwn(payload, 'thumbnail')) updateData.thumbnail = normalizeText(payload.thumbnail)

  if (hasOwn(payload, 'category') || hasOwn(payload, 'categorySlug') || hasOwn(payload, 'categoryRef')) {
    const category = await resolveCategory({
      categorySlug: payload.categorySlug,
      categoryRef: payload.categoryRef,
      categoryName: payload.category
    })
    updateData.category = normalizeText(payload.category) || category?.name || ''
    updateData.categoryRef = category?._id || null
  }

  if (hasOwn(payload, 'tagIds') || hasOwn(payload, 'tags')) {
    const resolvedTags = await resolveTags({ tagIds: payload.tagIds, tags: payload.tags })
    updateData.tags = resolvedTags.length > 0 ? resolvedTags.map(tag => tag.name) : normalizeTags(payload.tags)
    updateData.tagIds = resolvedTags.map(tag => tag._id)
  }
  if (hasOwn(payload, 'relatedProducts') || hasOwn(payload, 'relatedProductIds')) {
    updateData.relatedProducts = normalizeObjectIdArray(payload.relatedProducts || payload.relatedProductIds, 'relatedProducts')
  }
  if (hasOwn(payload, 'translations')) updateData.translations = normalizeTranslations(payload.translations)

  const nextStatus = hasOwn(payload, 'status')
    ? normalizeStatus(payload.status, currentPost.status)
    : currentPost.status
  updateData.status = nextStatus

  if (hasOwn(payload, 'reviewStatus')) {
    updateData.reviewStatus = normalizeReviewStatus(payload.reviewStatus, currentPost.reviewStatus)
  } else if (hasOwn(payload, 'status') && nextStatus === 'published') {
    updateData.reviewStatus = 'approved'
  }

  if (hasOwn(payload, 'source')) updateData.source = normalizeSource(payload.source, currentPost.source)
  if (hasOwn(payload, 'seo') || hasOwn(payload, 'seoTitle') || hasOwn(payload, 'seoDescription') || hasOwn(payload, 'seoKeywords') || hasOwn(payload, 'canonicalUrl')) {
    updateData.seo = normalizeSeo(
      payload,
      updateData.title || currentPost.title,
      updateData.excerpt || currentPost.excerpt,
      currentPost.seo || {}
    )
  }
  if (hasOwn(payload, 'autoPublish') || hasOwn(payload, 'autoPublishEnabled') || hasOwn(payload, 'priority')) {
    updateData.autoPublish = normalizeAutoPublish(payload, currentPost.autoPublish || {})
  }
  if (hasOwn(payload, 'ai')) {
    updateData.ai = normalizeAi(payload, currentPost.ai || {})
  }
  if (hasOwn(payload, 'isFeatured')) {
    updateData.isFeatured = parseBoolean(payload.isFeatured, 'isFeatured') ?? false
  }
  if (hasOwn(payload, 'scheduledAt')) {
    updateData.scheduledAt = normalizeDate(payload.scheduledAt, 'Scheduled date')
  }

  if (hasOwn(payload, 'publishedAt') || hasOwn(payload, 'status')) {
    updateData.publishedAt = normalizePublishedAt(payload.publishedAt, nextStatus, currentPost.publishedAt)
    if (nextStatus === 'published' && !currentPost.publishedBy) {
      updateData.publishedBy = getAdminId(user)
    }
  }

  updateData.updatedBy = getAdminId(user)
  updateData.updatedAt = new Date()

  try {
    await createRevision({ entityType: 'blog_post', entityId: currentPost._id, snapshot: currentPost.toObject ? currentPost.toObject() : currentPost, message: 'Before update', user })
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
  post.autoPublish.enabled = false
  await post.save()

  return {
    message: 'Blog post deleted successfully'
  }
}

async function approveAndQueueBlogPost({ postId, adminId, priority = 0 }) {
  const post = await getBlogPostByIdOrThrow(postId)

  if (post.status === 'published') {
    throw new AppError('Published post cannot be queued', 400)
  }

  post.status = 'queued'
  post.reviewStatus = 'approved'
  post.autoPublish.enabled = true
  post.autoPublish.priority = normalizeNumber(priority, 0)
  post.autoPublish.approvedAt = new Date()
  post.autoPublish.approvedBy = adminId || null

  await post.save()

  return {
    message: 'Blog post approved and queued successfully',
    data: post
  }
}

async function approveAndScheduleBlogPost({ postId, adminId, scheduledAt, priority = 0 }) {
  const parsedScheduledAt = normalizeDate(scheduledAt, 'Scheduled date')
  if (!parsedScheduledAt) {
    throw new AppError('scheduledAt is required', 400)
  }

  const post = await getBlogPostByIdOrThrow(postId)

  if (post.status === 'published') {
    throw new AppError('Published post cannot be scheduled', 400)
  }

  post.status = 'queued'
  post.reviewStatus = 'approved'
  post.scheduledAt = parsedScheduledAt
  post.autoPublish.enabled = true
  post.autoPublish.priority = normalizeNumber(priority, 0)
  post.autoPublish.approvedAt = new Date()
  post.autoPublish.approvedBy = adminId || null

  await post.save()

  return {
    message: 'Blog post approved and scheduled successfully',
    data: post
  }
}

async function publishBlogPostNow({ postId, adminId }) {
  const post = await getBlogPostByIdOrThrow(postId)

  if (post.reviewStatus !== 'approved') {
    throw new AppError('Only approved posts can be published', 400)
  }

  post.status = 'published'
  post.publishedAt = new Date()
  post.publishedBy = adminId || null
  post.autoPublish.enabled = false

  await post.save()

  return {
    message: 'Blog post published successfully',
    data: post
  }
}

async function rejectBlogPost({ postId }) {
  const post = await getBlogPostByIdOrThrow(postId)

  if (post.status === 'published') {
    throw new AppError('Published post cannot be rejected', 400)
  }

  post.status = 'draft'
  post.reviewStatus = 'rejected'
  post.autoPublish.enabled = false

  await post.save()

  return {
    message: 'Blog post rejected successfully',
    data: post
  }
}

async function markNeedsEdit({ postId }) {
  const post = await getBlogPostByIdOrThrow(postId)

  if (post.status === 'published') {
    throw new AppError('Published post cannot be marked as needs edit', 400)
  }

  post.status = 'draft'
  post.reviewStatus = 'needs_edit'
  post.autoPublish.enabled = false

  await post.save()

  return {
    message: 'Blog post marked as needs edit successfully',
    data: post
  }
}

async function archiveBlogPost({ postId }) {
  const post = await getBlogPostByIdOrThrow(postId)

  post.status = 'archived'
  post.autoPublish.enabled = false

  await post.save()

  return {
    message: 'Blog post archived successfully',
    data: post
  }
}

async function reviewBlogPost({ postId, reviewStatus }) {
  const post = await getBlogPostByIdOrThrow(postId)
  post.reviewStatus = normalizeReviewStatus(reviewStatus)

  if (post.reviewStatus !== 'approved' && post.status === 'queued') {
    post.status = 'draft'
    post.autoPublish.enabled = false
  }

  await post.save()

  return {
    message: 'Blog post review status updated successfully',
    data: post
  }
}

module.exports = {
  listBlogPosts,
  listPublishQueue,
  getBlogPost,
  previewBlogPost,
  createBlogPost,
  updateBlogPost,
  deleteBlogPost,
  approveAndQueueBlogPost,
  approveAndScheduleBlogPost,
  publishBlogPostNow,
  rejectBlogPost,
  markNeedsEdit,
  archiveBlogPost,
  reviewBlogPost
}
