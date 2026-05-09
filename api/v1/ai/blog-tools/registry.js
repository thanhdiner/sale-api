const { getTrendingProducts } = require('./executors/getTrendingProducts.tool')
const { getRecentBlogPosts } = require('./executors/getRecentBlogPosts.tool')
const { checkDuplicateBlogTopic } = require('./executors/checkDuplicateBlogTopic.tool')
const { suggestRelatedProducts } = require('./executors/suggestRelatedProducts.tool')
const { createBlogDraft } = require('./executors/createBlogDraft.tool')

const getBlogToolRegistry = () => ({
  getTrendingProducts,
  getRecentBlogPosts,
  checkDuplicateBlogTopic,
  suggestRelatedProducts,
  createBlogDraft
})

module.exports = {
  getBlogToolRegistry
}









