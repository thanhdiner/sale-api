const slugify = require('slugify')
const logger = require('../../../../config/logger')
const cache = require('../../../../config/redis')
const BlogPost = require('../../models/blogPost.model')
const BlogCategory = require('../../models/blogCategory.model')
const blogPostRepository = require('../../repositories/blogPost.repository')
const getRequestLanguage = require('../../utils/getRequestLanguage')

const BLOG_TRANSLATION_FIELDS = ['title', 'excerpt', 'content', 'category', 'tags']

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function buildTextSearch(value) {
  return { $regex: escapeRegex(value), $options: 'i' }
}

function hasValue(value) {
  if (Array.isArray(value)) return value.length > 0
  return typeof value === 'string' && value.trim().length > 0
}

function toPlainObject(item) {
  if (!item) return item
  return item.toObject ? item.toObject() : { ...item }
}

function appendAndFilter(query, filter) {
  query.$and = [...(query.$and || []), filter]
}

function getPublishedBaseQuery() {
  return {
    isDeleted: false,
    status: 'published',
    publishedAt: { $lte: new Date() }
  }
}

function applyBlogPostLanguage(post, lang = 'vi') {
  const obj = toPlainObject(post)
  if (!obj || lang !== 'en') return obj

  const translated = obj.translations?.en
  if (!translated) return obj

  BLOG_TRANSLATION_FIELDS.forEach(field => {
    if (hasValue(translated[field])) {
      obj[field] = translated[field]
    }
  })

  obj.seo = {
    ...(obj.seo || {}),
    title: translated.seoTitle || obj.seo?.title,
    description: translated.seoDescription || obj.seo?.description
  }

  return obj
}

function applyBlogCategoryLanguage(category, lang = 'vi') {
  const obj = toPlainObject(category)
  if (!obj || lang !== 'en') return obj

  const translated = obj.translations?.en
  if (!translated) return obj

  if (hasValue(translated.name)) obj.name = translated.name
  if (hasValue(translated.description)) obj.description = translated.description

  return obj
}

async function resolveCategoryFilter(category) {
  const value = normalizeText(category)
  if (!value) return null

  const categoryDoc = await BlogCategory.findOne({
    isActive: true,
    $or: [
      { slug: value },
      { name: buildTextSearch(value) },
      { 'translations.en.name': buildTextSearch(value) }
    ]
  }).select('_id').lean()

  const filters = [
    { category: buildTextSearch(value) },
    { 'translations.en.category': buildTextSearch(value) }
  ]

  if (categoryDoc?._id) {
    filters.push({ categoryRef: categoryDoc._id })
  }

  return { $or: filters }
}

async function buildPublicListQuery(params = {}) {
  const query = getPublishedBaseQuery()
  const category = normalizeText(params.category)
  const keyword = normalizeText(params.keyword || params.search)
  const tag = normalizeText(params.tag)

  const categoryFilter = await resolveCategoryFilter(category)
  if (categoryFilter) appendAndFilter(query, categoryFilter)

  if (tag) {
    appendAndFilter(query, {
      $or: [
        { tags: tag },
        { 'translations.en.tags': tag }
      ]
    })
  }

  if (keyword) {
    const keywordFilters = [
      { title: buildTextSearch(keyword) },
      { excerpt: buildTextSearch(keyword) },
      { content: buildTextSearch(keyword) },
      { category: buildTextSearch(keyword) },
      { tags: buildTextSearch(keyword) },
      { 'translations.en.title': buildTextSearch(keyword) },
      { 'translations.en.excerpt': buildTextSearch(keyword) },
      { 'translations.en.content': buildTextSearch(keyword) },
      { 'translations.en.category': buildTextSearch(keyword) },
      { 'translations.en.tags': buildTextSearch(keyword) },
      { 'seo.title': buildTextSearch(keyword) },
      { 'seo.description': buildTextSearch(keyword) },
      { 'seo.keywords': buildTextSearch(keyword) }
    ]

    appendAndFilter(query, { $or: keywordFilters })
  }

  return query
}

module.exports.index = async (req, res) => {
  try {
    const language = getRequestLanguage(req)
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1)
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 12, 1), 60)
    const category = normalizeText(req.query.category)
    const keyword = normalizeText(req.query.keyword || req.query.search)
    const tag = normalizeText(req.query.tag)
    const cacheKey = `blog:list:${page}:${limit}:${category}:${keyword}:${tag}`

    const result = await cache.getOrSet(cacheKey, async () => {
      const query = await buildPublicListQuery(req.query)
      const total = await blogPostRepository.countByQuery(query)
      const posts = await blogPostRepository.findByQuery(query, {
        sort: { isFeatured: -1, publishedAt: -1, updatedAt: -1 },
        skip: (page - 1) * limit,
        limit,
        lean: true
      })

      return {
        message: 'Blog posts fetched successfully',
        data: posts,
        total,
        page,
        limit
      }
    }, 300)

    res.status(200).json({
      ...result,
      data: Array.isArray(result.data)
        ? result.data.map(post => applyBlogPostLanguage(post, language))
        : []
    })
  } catch (err) {
    logger.error('[Client] Error fetching blog posts:', err)
    res.status(500).json({ error: 'Failed to fetch blog posts' })
  }
}

module.exports.show = async (req, res) => {
  try {
    const language = getRequestLanguage(req)
    const slug = normalizeText(req.params.slug)
    const cacheKey = `blog:detail:${slug}`

    const result = await cache.getOrSet(cacheKey, async () => {
      const post = await blogPostRepository.findOne({
        slug,
        ...getPublishedBaseQuery()
      }, { lean: true })

      if (!post) {
        return null
      }

      return {
        message: 'Blog post fetched successfully',
        data: post
      }
    }, 300)

    if (!result) {
      return res.status(404).json({ error: 'Blog post not found' })
    }

    res.status(200).json({
      ...result,
      data: applyBlogPostLanguage(result.data, language)
    })
  } catch (err) {
    logger.error('[Client] Error fetching blog post:', err)
    res.status(500).json({ error: 'Failed to fetch blog post' })
  }
}

module.exports.categories = async (req, res) => {
  try {
    const language = getRequestLanguage(req)
    const cacheKey = 'blog:categories'

    const result = await cache.getOrSet(cacheKey, async () => {
      const [categories, legacyCategories] = await Promise.all([
        BlogCategory.find({ isActive: true })
          .sort({ sortOrder: 1, name: 1 })
          .lean(),
        BlogPost.distinct('category', getPublishedBaseQuery())
      ])

      const categorySlugs = new Set(categories.map(category => category.slug))
      const legacyItems = legacyCategories
        .map(name => normalizeText(name))
        .filter(Boolean)
        .map(name => ({
          _id: null,
          name,
          slug: slugify(name, { lower: true, strict: true, locale: 'vi' }) || name,
          description: '',
          translations: { en: { name: '', description: '' } },
          isLegacy: true
        }))
        .filter(category => !categorySlugs.has(category.slug))

      return {
        message: 'Blog categories fetched successfully',
        data: [...categories, ...legacyItems]
      }
    }, 300)

    res.status(200).json({
      ...result,
      data: Array.isArray(result.data)
        ? result.data.map(category => applyBlogCategoryLanguage(category, language))
        : []
    })
  } catch (err) {
    logger.error('[Client] Error fetching blog categories:', err)
    res.status(500).json({ error: 'Failed to fetch blog categories' })
  }
}

module.exports.tags = async (req, res) => {
  try {
    const cacheKey = 'blog:tags'
    const result = await cache.getOrSet(cacheKey, async () => {
      const [tags, enTags] = await Promise.all([
        BlogPost.distinct('tags', getPublishedBaseQuery()),
        BlogPost.distinct('translations.en.tags', getPublishedBaseQuery())
      ])
      const data = Array.from(new Set([...(tags || []), ...(enTags || [])]
        .map(tag => normalizeText(tag))
        .filter(Boolean)))
        .sort((a, b) => a.localeCompare(b))

      return {
        message: 'Blog tags fetched successfully',
        data
      }
    }, 300)

    res.status(200).json(result)
  } catch (err) {
    logger.error('[Client] Error fetching blog tags:', err)
    res.status(500).json({ error: 'Failed to fetch blog tags' })
  }
}

module.exports.applyBlogPostLanguage = applyBlogPostLanguage
