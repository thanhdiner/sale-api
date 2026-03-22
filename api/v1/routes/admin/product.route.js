const express = require('express')
const router = express.Router()
const controller = require('../../controllers/admin/products.controller')

const multer = require('multer')
const fileUpload = multer()

const uploadCloud = require('../../middlewares/admin/uploadCloud.middleware')
const checkPermission = require('../../middlewares/admin/checkPermission.middleware')

const validate = require('../../middlewares/validate.middleware')
const productSchemas = require('../../validations/adminProduct.validation')

router.get('/', checkPermission.checkPermission('view_products'), controller.index)
router.get('/:id', checkPermission.checkPermission('view_products'), controller.detail)
router.post(
  '/create',
  checkPermission.checkPermission('create_product'),
  fileUpload.single('thumbnail'),
  uploadCloud.upload,
  validate(productSchemas.createProduct),
  controller.create
)
router.patch('/delete/:id', checkPermission.checkPermission('delete_product'), controller.delete)
router.patch('/delete-many', checkPermission.checkPermission('delete_product'), validate(productSchemas.deleteMany), controller.deleteMany)
router.patch('/changeStatus/:id', checkPermission.checkPermission('edit_product'), controller.changeStatus)
router.patch('/change-status-many', checkPermission.checkPermission('edit_product'), validate(productSchemas.changeStatusMany), controller.changeStatusMany)
router.patch('/change-position-many', checkPermission.checkPermission('edit_product'), validate(productSchemas.changePositionMany), controller.changePositionMany)
router.patch(
  '/edit/:id',
  checkPermission.checkPermission('edit_product'),
  fileUpload.single('thumbnail'),
  uploadCloud.deleteImage,
  uploadCloud.upload,
  validate(productSchemas.editProduct),
  controller.edit
)

module.exports = router

