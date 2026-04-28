const logger = require('../../../../config/logger')
const blogService = require('../../services/admin/blog.service')

const handleKnownControllerError = (res, error) => {
  if (!error?.statusCode) {
    return false
  }

  const payload = { message: error.message }
  if (error.details) {
    payload.details = error.details
  }

  res.status(error.statusCode).json(payload)
  return true
}

module.exports.index = async (req, res) => {
  try {
    const result = await blogService.listBlogPosts(req.query)
    res.status(200).json(result)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error('[Admin] Error fetching blog posts:', err)
    res.status(500).json({ error: 'Failed to fetch blog posts' })
  }
}

module.exports.show = async (req, res) => {
  try {
    const result = await blogService.getBlogPost(req.params.id)
    res.status(200).json(result)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error('[Admin] Error fetching blog post:', err)
    res.status(500).json({ error: 'Failed to fetch blog post' })
  }
}

module.exports.create = async (req, res) => {
  try {
    const result = await blogService.createBlogPost(req.body, req.user)
    res.status(201).json(result)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error('[Admin] Error creating blog post:', err)
    res.status(500).json({ error: 'Failed to create blog post' })
  }
}

module.exports.edit = async (req, res) => {
  try {
    const result = await blogService.updateBlogPost(req.params.id, req.body, req.user)
    res.status(200).json(result)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error('[Admin] Error updating blog post:', err)
    res.status(500).json({ error: 'Failed to update blog post' })
  }
}

module.exports.delete = async (req, res) => {
  try {
    const result = await blogService.deleteBlogPost(req.params.id)
    res.status(200).json(result)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error('[Admin] Error deleting blog post:', err)
    res.status(500).json({ error: 'Failed to delete blog post' })
  }
}
