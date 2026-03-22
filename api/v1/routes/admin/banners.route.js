const express = require('express')
const router = express.Router()

const bannerController = require('../../controllers/admin/banners.controller')
const checkPermission = require('../../middlewares/admin/checkPermission.middleware')
const { invalidateBanners } = require('../../middlewares/cacheInvalidation.middleware')

const multer = require('multer')
const fileUpload = multer()
const uploadCloud = require('../../middlewares/admin/uploadCloud.middleware')

router.get('/', checkPermission.checkPermission('view_banners'), bannerController.index)

router.post('/', checkPermission.checkPermission('create_banner'), fileUpload.single('img'), uploadCloud.upload, bannerController.create, invalidateBanners)

router.patch(
  '/:id',
  checkPermission.checkPermission('edit_banner'),
  fileUpload.single('img'),
  uploadCloud.upload,
  uploadCloud.deleteImage,
  bannerController.edit,
  invalidateBanners
)

router.delete('/:id', checkPermission.checkPermission('delete_banner'), bannerController.delete, invalidateBanners)

module.exports = router
