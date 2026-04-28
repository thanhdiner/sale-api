const express = require('express')
const router = express.Router()

const bannerController = require('../../controllers/admin/banners.controller')
const checkPermission = require('../../middlewares/admin/checkPermission.middleware')
const { invalidateBanners } = require('../../middlewares/cacheInvalidation.middleware')
const parseJsonBodyField = require('../../utils/parseJsonBodyField')

const multer = require('multer')
const fileUpload = multer()
const uploadCloud = require('../../middlewares/admin/uploadCloud.middleware')

const parseBannerJsonBodyFields = (req, res, next) => {
  parseJsonBodyField(req.body, 'translations')
  next()
}

router.get('/', checkPermission.checkPermission('view_banners'), bannerController.index)

router.post(
  '/',
  checkPermission.checkPermission('create_banner'),
  fileUpload.single('img'),
  uploadCloud.upload,
  parseBannerJsonBodyFields,
  invalidateBanners,
  bannerController.create
)

router.patch(
  '/:id',
  checkPermission.checkPermission('edit_banner'),
  fileUpload.single('img'),
  uploadCloud.upload,
  uploadCloud.deleteImage,
  parseBannerJsonBodyFields,
  invalidateBanners,
  bannerController.edit,
)

router.delete('/:id', checkPermission.checkPermission('delete_banner'), invalidateBanners, bannerController.delete)

module.exports = router
