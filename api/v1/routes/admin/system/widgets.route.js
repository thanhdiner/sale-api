const express = require('express')
const router = express.Router()

const controller = require('../../../controllers/admin/system/widgets.controller')

const multer = require('multer')
const fileUpload = multer()
const uploadCloud = require('../../../middlewares/upload/uploadCloud.middleware')

const checkPermission = require('../../../middlewares/admin/checkPermission.middleware')
const { invalidateWidgets } = require('../../../middlewares/cache/cacheInvalidation.middleware')
const parseJsonBodyField = require('../../../utils/parseJsonBodyField')

const parseWidgetJsonBodyFields = (req, res, next) => {
  parseJsonBodyField(req.body, 'translations')
  next()
}

router.get('/', checkPermission.checkPermission('view_widgets'), controller.index)
router.post(
  '/',
  checkPermission.checkPermission('create_widget'),
  fileUpload.single('iconUrl'),
  uploadCloud.upload,
  parseWidgetJsonBodyFields,
  invalidateWidgets,
  controller.create
)
router.patch(
  '/:id',
  checkPermission.checkPermission('edit_widget'),
  fileUpload.single('iconUrl'),
  uploadCloud.upload,
  uploadCloud.deleteImage,
  parseWidgetJsonBodyFields,
  invalidateWidgets,
  controller.edit
)
router.delete('/:id', checkPermission.checkPermission('delete_widget'), invalidateWidgets, controller.delete)

module.exports = router











