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

module.exports.review = async (req, res) => {
  try {
    const result = await blogService.reviewBlogPost({
      postId: req.params.id,
      reviewStatus: req.body.reviewStatus
    })
    res.status(200).json(result)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error('[Admin] Error reviewing blog post:', err)
    res.status(500).json({ error: 'Failed to review blog post' })
  }
}

module.exports.approveAndQueue = async (req, res) => {
  try {
    const result = await blogService.approveAndQueueBlogPost({
      postId: req.params.id,
      adminId: req.user?.userId || req.user?.id || null,
      priority: req.body.priority || 0
    })
    res.status(200).json(result)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error('[Admin] Error approving blog post queue:', err)
    res.status(500).json({ error: 'Failed to approve and queue blog post' })
  }
}

module.exports.approveAndSchedule = async (req, res) => {
  try {
    const result = await blogService.approveAndScheduleBlogPost({
      postId: req.params.id,
      adminId: req.user?.userId || req.user?.id || null,
      scheduledAt: req.body.scheduledAt,
      priority: req.body.priority || 0
    })
    res.status(200).json(result)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error('[Admin] Error scheduling blog post:', err)
    res.status(500).json({ error: 'Failed to approve and schedule blog post' })
  }
}

module.exports.publishNow = async (req, res) => {
  try {
    const result = await blogService.publishBlogPostNow({
      postId: req.params.id,
      adminId: req.user?.userId || req.user?.id || null
    })
    res.status(200).json(result)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error('[Admin] Error publishing blog post:', err)
    res.status(500).json({ error: 'Failed to publish blog post' })
  }
}

module.exports.rejectBlogPost = async (req, res) => {
  try {
    const result = await blogService.rejectBlogPost({ postId: req.params.id })
    res.status(200).json(result)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error('[Admin] Error rejecting blog post:', err)
    res.status(500).json({ error: 'Failed to reject blog post' })
  }
}

module.exports.markNeedsEdit = async (req, res) => {
  try {
    const result = await blogService.markNeedsEdit({ postId: req.params.id })
    res.status(200).json(result)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error('[Admin] Error marking blog post needs edit:', err)
    res.status(500).json({ error: 'Failed to mark blog post as needs edit' })
  }
}

module.exports.archive = async (req, res) => {
  try {
    const result = await blogService.archiveBlogPost({ postId: req.params.id })
    res.status(200).json(result)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error('[Admin] Error archiving blog post:', err)
    res.status(500).json({ error: 'Failed to archive blog post' })
  }
}

module.exports.publishQueue = async (req, res) => {
  try {
    const result = await blogService.listPublishQueue(req.query)
    res.status(200).json(result)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error('[Admin] Error fetching blog publish queue:', err)
    res.status(500).json({ error: 'Failed to fetch blog publish queue' })
  }
}
