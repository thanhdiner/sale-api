const express = require('express')
const router = express.Router()
const controller = require('../../controllers/admin/product-categories.controller')

const multer = require('multer')
const fileUpload = multer()

const uploadCloud = require('../../middlewares/admin/uploadCloud.middleware')

router.get('/', controller.index)
router.get('/tree', controller.getProductCategoryTree)
router.patch('/changeStatus/:id', controller.changeStatus)
router.patch('/change-status-many', controller.changeStatusMany)
router.patch('/delete/:id', controller.delete)
router.patch('/delete-many', controller.deleteMany)
router.patch('/change-position-many', controller.changePositionMany)
router.post('/create', fileUpload.single('thumbnail'), uploadCloud.upload, controller.create)
router.get('/:id', controller.detail)
router.patch('/edit/:id', fileUpload.single('thumbnail'), uploadCloud.deleteImage, uploadCloud.upload, controller.edit)

module.exports = router
