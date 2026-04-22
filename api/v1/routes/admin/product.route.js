const express = require('express')
const router = express.Router()
const controller = require('../../controllers/admin/products.controller')

const multer = require('multer')
const fileUpload = multer()

const uploadCloud = require('../../middlewares/admin/uploadCloud.middleware')
const checkPermission = require('../../middlewares/admin/checkPermission.middleware')

const validate = require('../../middlewares/validate.middleware')
const productSchemas = require('../../validations/adminProduct.validation')
const { invalidateProducts } = require('../../middlewares/cacheInvalidation.middleware')

const productImageUpload = fileUpload.fields([
  { name: 'thumbnail', maxCount: 1 },
  { name: 'images', maxCount: 12 }
])

router.get('/', checkPermission.checkPermission('view_products'), controller.index)

router.get('/:id', checkPermission.checkPermission('view_products'), controller.detail)

router.post(
  '/create',
  checkPermission.checkPermission('create_product'),
  productImageUpload,
  uploadCloud.uploadMany,
  validate(productSchemas.createProduct),
  controller.create,
  invalidateProducts
)

router.patch('/delete/:id', checkPermission.checkPermission('delete_product'), controller.delete, invalidateProducts)

router.patch(
  '/delete-many',
  checkPermission.checkPermission('delete_product'),
  validate(productSchemas.deleteMany),
  controller.deleteMany,
  invalidateProducts
)

router.patch('/changeStatus/:id', checkPermission.checkPermission('edit_product'), controller.changeStatus, invalidateProducts)

router.patch(
  '/change-status-many',
  checkPermission.checkPermission('edit_product'),
  validate(productSchemas.changeStatusMany),
  controller.changeStatusMany,
  invalidateProducts
)

router.patch(
  '/change-position-many',
  checkPermission.checkPermission('edit_product'),
  validate(productSchemas.changePositionMany),
  controller.changePositionMany,
  invalidateProducts
)

router.patch(
  '/edit/:id',
  checkPermission.checkPermission('edit_product'),
  productImageUpload,
  uploadCloud.deleteImage,
  uploadCloud.deleteImageMany,
  uploadCloud.uploadMany,
  validate(productSchemas.editProduct),
  controller.edit,
  invalidateProducts
)

module.exports = router