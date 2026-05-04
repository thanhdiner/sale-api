const logger = require('../../../../config/logger')
const blogService = require('../../services/admin/blog.service')
const mediaLibraryService = require('../../services/admin/mediaLibrary.service')
const { uploadBufferToCloudinary } = require('../../middlewares/admin/uploadCloud.middleware')

const BLOG_MEDIA_IMAGE_MAX_SIZE = 5 * 1024 * 1024
const BLOG_MEDIA_VIDEO_MAX_SIZE = 50 * 1024 * 1024
const BLOG_MEDIA_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const BLOG_MEDIA_VIDEO_TYPES = new Set(['video/mp4', 'video/webm', 'video/quicktime'])

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

module.exports.preview = async (req, res) => {
  try {
    const result = await blogService.previewBlogPost(req.params.id)
    res.status(200).json(result)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error('[Admin] Error fetching blog post preview:', err)
    res.status(500).json({ error: 'Failed to fetch blog post preview' })
  }
}

module.exports.uploadMedia = async (req, res) => {
  try {
    const file = req.file

    if (!file) {
      return res.status(400).json({ message: 'No media file uploaded' })
    }

    const isImage = BLOG_MEDIA_IMAGE_TYPES.has(file.mimetype)
    const isVideo = BLOG_MEDIA_VIDEO_TYPES.has(file.mimetype)

    if (!isImage && !isVideo) {
      return res.status(400).json({ message: 'Unsupported media type' })
    }

    const maxSize = isVideo ? BLOG_MEDIA_VIDEO_MAX_SIZE : BLOG_MEDIA_IMAGE_MAX_SIZE
    if (file.size > maxSize) {
      return res.status(400).json({ message: `Media file must be smaller than ${Math.floor(maxSize / 1024 / 1024)}MB` })
    }

    const resourceType = isVideo ? 'video' : 'image'
    const result = await uploadBufferToCloudinary(file, {
      folder: 'blog-content',
      resource_type: resourceType
    })
    const asset = await mediaLibraryService.createAssetFromUpload(result, file, req.user)

    res.status(201).json({
      url: result.secure_url,
      resourceType,
      mimeType: file.mimetype,
      asset
    })
  } catch (err) {
    logger.error('[Admin] Error uploading blog media:', err)
    res.status(500).json({ error: 'Failed to upload blog media' })
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
