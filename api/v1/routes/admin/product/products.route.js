const express = require('express')
const router = express.Router()
const controller = require('../../../controllers/admin/product/products.controller')

const multer = require('multer')
const fileUpload = multer()

const uploadCloud = require('../../../middlewares/upload/uploadCloud.middleware')
const checkPermission = require('../../../middlewares/admin/checkPermission.middleware')

const validate = require('../../../middlewares/validation/validate.middleware')
const productSchemas = require('../../../validations/product/adminProduct.validation')
const { invalidateProducts } = require('../../../middlewares/cache/cacheInvalidation.middleware')
const parseJsonBodyField = require('../../../utils/parseJsonBodyField')

const productImageUpload = fileUpload.fields([
  { name: 'thumbnail', maxCount: 1 },
  { name: 'images', maxCount: 12 }
])

const parseProductJsonBodyFields = (req, res, next) => {
  parseJsonBodyField(req.body, 'translations')
  next()
}

router.get('/', checkPermission.checkPermission('view_products'), controller.index)

router.get('/:id', checkPermission.checkPermission('view_products'), controller.detail)

router.post(
  '/create',
  checkPermission.checkPermission('create_product'),
  productImageUpload,
  uploadCloud.uploadMany,
  parseProductJsonBodyFields,
  validate(productSchemas.createProduct),
  invalidateProducts,
  controller.create
)

router.patch('/delete/:id', checkPermission.checkPermission('delete_product'), invalidateProducts, controller.delete)

router.patch(
  '/delete-many',
  checkPermission.checkPermission('delete_product'),
  validate(productSchemas.deleteMany),
  invalidateProducts,
  controller.deleteMany
)

router.patch('/changeStatus/:id', checkPermission.checkPermission('edit_product'), invalidateProducts, controller.changeStatus)

router.patch(
  '/change-status-many',
  checkPermission.checkPermission('edit_product'),
  validate(productSchemas.changeStatusMany),
  invalidateProducts,
  controller.changeStatusMany
)

router.patch(
  '/change-position-many',
  checkPermission.checkPermission('edit_product'),
  validate(productSchemas.changePositionMany),
  invalidateProducts,
  controller.changePositionMany
)

router.patch(
  '/edit/:id',
  checkPermission.checkPermission('edit_product'),
  productImageUpload,
  uploadCloud.deleteImage,
  uploadCloud.deleteImageMany,
  uploadCloud.uploadMany,
  parseProductJsonBodyFields,
  validate(productSchemas.editProduct),
  invalidateProducts,
  controller.edit
)

module.exports = router











