const express = require('express')
const router = express.Router()

const controller = require('../../controllers/admin/widgets.controller')

const multer = require('multer')
const fileUpload = multer()
const uploadCloud = require('../../middlewares/admin/uploadCloud.middleware')

const checkPermission = require('../../middlewares/admin/checkPermission.middleware')
const { invalidateWidgets } = require('../../middlewares/cacheInvalidation.middleware')

router.get('/', checkPermission.checkPermission('view_widgets'), controller.index)
router.post('/', checkPermission.checkPermission('create_widget'), fileUpload.single('iconUrl'), uploadCloud.upload, controller.create, invalidateWidgets)
router.patch(
  '/:id',
  checkPermission.checkPermission('edit_widget'),
  fileUpload.single('iconUrl'),
  uploadCloud.upload,
  uploadCloud.deleteImage,
  controller.edit,
  invalidateWidgets
)
router.delete('/:id', checkPermission.checkPermission('delete_widget'), controller.delete, invalidateWidgets)

module.exports = router
