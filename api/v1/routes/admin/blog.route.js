const express = require('express')
const router = express.Router()

const controller = require('../../controllers/admin/blog.controller')
const multer = require('multer')
const fileUpload = multer()
const uploadCloud = require('../../middlewares/admin/uploadCloud.middleware')
const parseJsonBodyField = require('../../utils/parseJsonBodyField')
const { invalidateBlog } = require('../../middlewares/cacheInvalidation.middleware')
const checkPermission = require('../../middlewares/admin/checkPermission.middleware')
const requireAnyPermission = permissions => checkPermission.checkAnyPermission
  ? checkPermission.checkAnyPermission(permissions)
  : checkPermission.checkPermission(permissions[0])

const parseBlogJsonBodyFields = (req, res, next) => {
  parseJsonBodyField(req.body, 'tags')
  parseJsonBodyField(req.body, 'translations')
  parseJsonBodyField(req.body, 'relatedProducts')
  parseJsonBodyField(req.body, 'relatedProductIds')
  parseJsonBodyField(req.body, 'seo')
  parseJsonBodyField(req.body, 'seoKeywords')
  parseJsonBodyField(req.body, 'autoPublish')
  parseJsonBodyField(req.body, 'ai')
  next()
}

router.get('/', checkPermission.checkPermission('view_blog'), controller.index)
router.get('/publish-queue', requireAnyPermission(['blog.publish', 'view_blog']), controller.publishQueue)
router.get('/:id', checkPermission.checkPermission('view_blog'), controller.show)
router.post(
  '/',
  checkPermission.checkPermission('create_blog'),
  fileUpload.single('thumbnail'),
  uploadCloud.upload,
  parseBlogJsonBodyFields,
  invalidateBlog,
  controller.create
)
router.patch(
  '/:id',
  checkPermission.checkPermission('edit_blog'),
  fileUpload.single('thumbnail'),
  uploadCloud.upload,
  uploadCloud.deleteImage,
  parseBlogJsonBodyFields,
  invalidateBlog,
  controller.edit
)
router.patch(
  '/:id/review',
  requireAnyPermission(['blog.review', 'edit_blog']),
  parseBlogJsonBodyFields,
  invalidateBlog,
  controller.review
)
router.patch(
  '/:id/approve-queue',
  requireAnyPermission(['blog.review', 'edit_blog']),
  parseBlogJsonBodyFields,
  invalidateBlog,
  controller.approveAndQueue
)
router.patch(
  '/:id/schedule',
  requireAnyPermission(['blog.review', 'edit_blog']),
  parseBlogJsonBodyFields,
  invalidateBlog,
  controller.approveAndSchedule
)
router.patch(
  '/:id/publish-now',
  requireAnyPermission(['blog.publish', 'edit_blog']),
  invalidateBlog,
  controller.publishNow
)
router.patch(
  '/:id/reject',
  requireAnyPermission(['blog.review', 'edit_blog']),
  invalidateBlog,
  controller.rejectBlogPost
)
router.patch(
  '/:id/needs-edit',
  requireAnyPermission(['blog.review', 'edit_blog']),
  invalidateBlog,
  controller.markNeedsEdit
)
router.patch(
  '/:id/archive',
  requireAnyPermission(['blog.review', 'edit_blog']),
  invalidateBlog,
  controller.archive
)
router.delete('/:id', checkPermission.checkPermission('delete_blog'), invalidateBlog, controller.delete)

module.exports = router
