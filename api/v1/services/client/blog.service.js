const logger = require('../../../../config/logger')
const cache = require('../../../../config/redis')
const blogPostRepository = require('../../repositories/blogPost.repository')
const applyTranslation = require('../../utils/applyTranslation')
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

function buildPublicListQuery(params = {}) {
  const now = new Date()
  const query = {
    isDeleted: false,
    status: 'published',
    $or: [
      { publishedAt: { $lte: now } },
      { publishedAt: null }
    ]
  }

  const category = normalizeText(params.category)
  const keyword = normalizeText(params.keyword)

  if (category) {
    query.$and = [
      { $or: query.$or },
      {
        $or: [
          { category: buildTextSearch(category) },
          { 'translations.en.category': buildTextSearch(category) }
        ]
      }
    ]
    delete query.$or
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
      { 'translations.en.tags': buildTextSearch(keyword) }
    ]

    query.$and = [
      ...(query.$and || (query.$or ? [{ $or: query.$or }] : [])),
      { $or: keywordFilters }
    ]
    delete query.$or
  }

  return query
}

module.exports.index = async (req, res) => {
  try {
    const language = getRequestLanguage(req)
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1)
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 12, 1), 60)
    const category = normalizeText(req.query.category)
    const keyword = normalizeText(req.query.keyword)
    const cacheKey = `blog:list:${page}:${limit}:${category}:${keyword}`

    const result = await cache.getOrSet(cacheKey, async () => {
      const query = buildPublicListQuery(req.query)
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
        ? result.data.map(post => applyTranslation(post, language, BLOG_TRANSLATION_FIELDS))
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
      const now = new Date()
      const post = await blogPostRepository.findOne({
        slug,
        isDeleted: false,
        status: 'published',
        $or: [
          { publishedAt: { $lte: now } },
          { publishedAt: null }
        ]
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
      data: applyTranslation(result.data, language, BLOG_TRANSLATION_FIELDS)
    })
  } catch (err) {
    logger.error('[Client] Error fetching blog post:', err)
    res.status(500).json({ error: 'Failed to fetch blog post' })
  }
}
