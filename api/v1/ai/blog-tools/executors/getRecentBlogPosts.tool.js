const BlogPost = require('../../../models/blogPost.model')

const normalizeLimit = value => Math.min(Math.max(parseInt(value, 10) || 20, 1), 50)

const getRecentBlogPosts = async ({ limit = 20 } = {}) => {
  return BlogPost.find({
    isDeleted: false,
    status: { $in: ['draft', 'queued', 'published'] }
  })
    .select('title slug excerpt tags category ai.topic createdAt publishedAt')
    .sort({ createdAt: -1 })
    .limit(normalizeLimit(limit))
    .lean()
}

module.exports = {
  getRecentBlogPosts
}
