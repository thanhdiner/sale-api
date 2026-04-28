const mongoose = require('mongoose')
const slugify = require('slugify')
const BlogPost = require('../../../models/blogPost.model')
const BlogCategory = require('../../../models/blogCategory.model')

const normalizeText = value => (typeof value === 'string' ? value.trim() : '')

const normalizeArray = value => (Array.isArray(value) ? value : [])
  .map(item => normalizeText(item))
  .filter(Boolean)

const normalizeObjectIds = value => normalizeArray(value)
  .filter(id => mongoose.Types.ObjectId.isValid(id))

const escapeRegex = value => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

async function buildNextSlug(baseSlug) {
  const existingPosts = await BlogPost.find({
    slug: new RegExp(`^${escapeRegex(baseSlug)}(-\\d+)?$`, 'i'),
    isDeleted: false
  }).select('slug').lean()

  if (existingPosts.length === 0) return baseSlug

  const suffixes = existingPosts.map(post => {
    const match = String(post.slug || '').match(new RegExp(`^${escapeRegex(baseSlug)}-(\\d+)$`, 'i'))
    return match ? Number(match[1]) : 0
  })

  return `${baseSlug}-${Math.max(...suffixes, 0) + 1}`
}

const createBlogDraft = async ({
  batchId,
  provider,
  model,
  title,
  excerpt,
  content,
  seoTitle,
  seoDescription,
  seoKeywords = [],
  categorySlug,
  category: categoryName,
  tags = [],
  relatedProductIds = [],
  translations = {},
  ai = {}
}) => {
  const normalizedTitle = normalizeText(title)
  const normalizedExcerpt = normalizeText(excerpt)
  const normalizedContent = normalizeText(content)

  if (!normalizedTitle || !normalizedExcerpt || !normalizedContent) {
    throw new Error('title, excerpt and content are required')
  }

  let category = null
  const normalizedCategorySlug = normalizeText(categorySlug)

  if (normalizedCategorySlug) {
    category = await BlogCategory.findOne({
      slug: normalizedCategorySlug,
      isActive: true
    }).select('_id name slug').lean()
  }

  if (!category && normalizeText(categoryName)) {
    category = await BlogCategory.findOne({
      isActive: true,
      $or: [
        { name: normalizeText(categoryName) },
        { slug: normalizeText(categoryName) },
        { 'translations.en.name': normalizeText(categoryName) }
      ]
    }).select('_id name slug').lean()
  }

  const baseSlug = slugify(normalizedTitle, { lower: true, strict: true, locale: 'vi' }) || `blog-${Date.now()}`
  const slug = await buildNextSlug(baseSlug)

  const post = await BlogPost.create({
    title: normalizedTitle,
    slug,
    excerpt: normalizedExcerpt,
    content: normalizedContent,
    translations,
    category: normalizeText(categoryName) || category?.name || '',
    categoryRef: category?._id || null,
    tags: normalizeArray(tags),
    relatedProducts: normalizeObjectIds(relatedProductIds),
    source: 'ai',
    status: 'draft',
    reviewStatus: 'pending',
    seo: {
      title: normalizeText(seoTitle) || normalizedTitle,
      description: normalizeText(seoDescription) || normalizedExcerpt,
      keywords: normalizeArray(seoKeywords)
    },
    ai: {
      generatedByAI: true,
      batchId: normalizeText(batchId),
      topic: normalizeText(ai.topic) || normalizedTitle,
      prompt: normalizeText(ai.prompt),
      provider: normalizeText(provider),
      model: normalizeText(model),
      qualityScore: Number(ai.qualityScore) || 0,
      duplicateRisk: ['low', 'medium', 'high'].includes(ai.duplicateRisk) ? ai.duplicateRisk : 'low',
      generatedAt: new Date()
    }
  })

  return {
    id: post._id,
    title: post.title,
    slug: post.slug,
    status: post.status,
    reviewStatus: post.reviewStatus
  }
}

module.exports = {
  createBlogDraft
}
