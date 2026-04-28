const express = require('express')
const router = express.Router()
const controller = require('../../controllers/admin/product-categories.controller')

const multer = require('multer')
const fileUpload = multer()

const uploadCloud = require('../../middlewares/admin/uploadCloud.middleware')

const checkPermission = require('../../middlewares/admin/checkPermission.middleware')
const { invalidateCategories } = require('../../middlewares/cacheInvalidation.middleware')
const parseJsonBodyField = require('../../utils/parseJsonBodyField')

const parseProductCategoryJsonBodyFields = (req, res, next) => {
  parseJsonBodyField(req.body, 'translations')
  next()
}

router.get('/', checkPermission.checkPermission('view_product_categories'), controller.index)
router.get('/tree', checkPermission.checkPermission('view_product_categories'), controller.getProductCategoryTree)
router.patch('/delete/:id', checkPermission.checkPermission('delete_product_category'), invalidateCategories, controller.delete)
router.patch('/delete-many', checkPermission.checkPermission('delete_product_category'), invalidateCategories, controller.deleteMany)
router.patch('/changeStatus/:id', checkPermission.checkPermission('edit_product_category'), invalidateCategories, controller.changeStatus)
router.patch('/change-status-many', checkPermission.checkPermission('edit_product_category'), invalidateCategories, controller.changeStatusMany)
router.patch('/change-position-many', checkPermission.checkPermission('edit_product_category'), invalidateCategories, controller.changePositionMany)
router.post(
  '/create',
  checkPermission.checkPermission('create_product_category'),
  fileUpload.single('thumbnail'),
  uploadCloud.upload,
  parseProductCategoryJsonBodyFields,
  invalidateCategories,
  controller.create
)
router.get('/:id', checkPermission.checkPermission('view_product_categories'), controller.detail)
router.patch(
  '/edit/:id',
  checkPermission.checkPermission('edit_product_category'),
  fileUpload.single('thumbnail'),
  uploadCloud.deleteImage,
  uploadCloud.upload,
  parseProductCategoryJsonBodyFields,
  invalidateCategories,
  controller.edit
)

module.exports = router
