const logger = require('../../../../../config/logger')
const blogService = require('../../../services/admin/blog/blog.service')
const mediaLibraryService = require('../../../services/admin/system/mediaLibrary.service')
const { uploadBufferToCloudinary } = require('../../../middlewares/upload/uploadCloud.middleware')
const AppError = require('../../../utils/AppError')

const BLOG_MEDIA_IMAGE_MAX_SIZE = 5 * 1024 * 1024
const BLOG_MEDIA_VIDEO_MAX_SIZE = 50 * 1024 * 1024
const BLOG_MEDIA_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const BLOG_MEDIA_VIDEO_TYPES = new Set(['video/mp4', 'video/webm', 'video/quicktime'])


module.exports.index = async (req, res, next) => {
  try {
    const result = await blogService.listBlogPosts(req.query)
    res.status(200).json(result)
  } catch (err) {
    return next(err)
  }
}

module.exports.show = async (req, res, next) => {
  try {
    const result = await blogService.getBlogPost(req.params.id)
    res.status(200).json(result)
  } catch (err) {
    return next(err)
  }
}

module.exports.preview = async (req, res, next) => {
  try {
    const result = await blogService.previewBlogPost(req.params.id)
    res.status(200).json(result)
  } catch (err) {
    return next(err)
  }
}

module.exports.uploadMedia = async (req, res, next) => {
  try {
    const file = req.file

    if (!file) {
      throw new AppError('No media file uploaded', 400)
    }

    const isImage = BLOG_MEDIA_IMAGE_TYPES.has(file.mimetype)
    const isVideo = BLOG_MEDIA_VIDEO_TYPES.has(file.mimetype)

    if (!isImage && !isVideo) {
      throw new AppError('Unsupported media type', 400)
    }

    const maxSize = isVideo ? BLOG_MEDIA_VIDEO_MAX_SIZE : BLOG_MEDIA_IMAGE_MAX_SIZE
    if (file.size > maxSize) {
      throw new AppError(`Media file must be smaller than ${Math.floor(maxSize / 1024 / 1024)}MB`, 400)
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
    return next(err)
  }
}

module.exports.create = async (req, res, next) => {
  try {
    const result = await blogService.createBlogPost(req.body, req.user)
    res.status(201).json(result)
  } catch (err) {
    return next(err)
  }
}

module.exports.edit = async (req, res, next) => {
  try {
    const result = await blogService.updateBlogPost(req.params.id, req.body, req.user)
    res.status(200).json(result)
  } catch (err) {
    return next(err)
  }
}

module.exports.delete = async (req, res, next) => {
  try {
    const result = await blogService.deleteBlogPost(req.params.id)
    res.status(200).json(result)
  } catch (err) {
    return next(err)
  }
}

module.exports.review = async (req, res, next) => {
  try {
    const result = await blogService.reviewBlogPost({
      postId: req.params.id,
      reviewStatus: req.body.reviewStatus
    })
    res.status(200).json(result)
  } catch (err) {
    return next(err)
  }
}

module.exports.approveAndQueue = async (req, res, next) => {
  try {
    const result = await blogService.approveAndQueueBlogPost({
      postId: req.params.id,
      adminId: req.user?.userId || req.user?.id || null,
      priority: req.body.priority || 0
    })
    res.status(200).json(result)
  } catch (err) {
    return next(err)
  }
}

module.exports.approveAndSchedule = async (req, res, next) => {
  try {
    const result = await blogService.approveAndScheduleBlogPost({
      postId: req.params.id,
      adminId: req.user?.userId || req.user?.id || null,
      scheduledAt: req.body.scheduledAt,
      priority: req.body.priority || 0
    })
    res.status(200).json(result)
  } catch (err) {
    return next(err)
  }
}

module.exports.publishNow = async (req, res, next) => {
  try {
    const result = await blogService.publishBlogPostNow({
      postId: req.params.id,
      adminId: req.user?.userId || req.user?.id || null
    })
    res.status(200).json(result)
  } catch (err) {
    return next(err)
  }
}

module.exports.rejectBlogPost = async (req, res, next) => {
  try {
    const result = await blogService.rejectBlogPost({ postId: req.params.id })
    res.status(200).json(result)
  } catch (err) {
    return next(err)
  }
}

module.exports.markNeedsEdit = async (req, res, next) => {
  try {
    const result = await blogService.markNeedsEdit({ postId: req.params.id })
    res.status(200).json(result)
  } catch (err) {
    return next(err)
  }
}

module.exports.archive = async (req, res, next) => {
  try {
    const result = await blogService.archiveBlogPost({ postId: req.params.id })
    res.status(200).json(result)
  } catch (err) {
    return next(err)
  }
}

module.exports.publishQueue = async (req, res, next) => {
  try {
    const result = await blogService.listPublishQueue(req.query)
    res.status(200).json(result)
  } catch (err) {
    return next(err)
  }
}










