const BlogPost = require('../../../models/blog/blogPost.model')

const normalizeText = (value = '') => String(value || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^\w\s]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const isSimilar = (left, right) => {
  if (!left || !right) return false
  return left.includes(right) || right.includes(left)
}

const checkDuplicateBlogTopic = async ({ topic }) => {
  const normalizedTopic = normalizeText(topic)

  if (!normalizedTopic) {
    return {
      duplicated: false,
      duplicateRisk: 'low'
    }
  }

  const posts = await BlogPost.find({
    isDeleted: false,
    status: { $in: ['draft', 'queued', 'published'] }
  })
    .select('title ai.topic')
    .sort({ createdAt: -1 })
    .limit(100)
    .lean()

  const duplicated = posts.some(post => (
    isSimilar(normalizeText(post.title), normalizedTopic)
    || isSimilar(normalizeText(post.ai?.topic), normalizedTopic)
  ))

  return {
    duplicated,
    duplicateRisk: duplicated ? 'high' : 'low'
  }
}

module.exports = {
  checkDuplicateBlogTopic
}









