const express = require('express')
const router = express.Router()

const controller = require('../../controllers/admin/blog.controller')
const multer = require('multer')
const fileUpload = multer()
const uploadCloud = require('../../middlewares/admin/uploadCloud.middleware')
const parseJsonBodyField = require('../../utils/parseJsonBodyField')
const { invalidateBlog } = require('../../middlewares/cacheInvalidation.middleware')

const parseBlogJsonBodyFields = (req, res, next) => {
  parseJsonBodyField(req.body, 'tags')
  parseJsonBodyField(req.body, 'translations')
  next()
}

router.get('/', controller.index)
router.get('/:id', controller.show)
router.post(
  '/',
  fileUpload.single('thumbnail'),
  uploadCloud.upload,
  parseBlogJsonBodyFields,
  invalidateBlog,
  controller.create
)
router.patch(
  '/:id',
  fileUpload.single('thumbnail'),
  uploadCloud.upload,
  uploadCloud.deleteImage,
  parseBlogJsonBodyFields,
  invalidateBlog,
  controller.edit
)
router.delete('/:id', invalidateBlog, controller.delete)

module.exports = router
