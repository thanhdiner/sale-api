const express = require('express')
const router = express.Router()
const controller = require('../../controllers/admin/products.controller')

const multer = require('multer')
const fileUpload = multer()

const uploadCloud = require('../../middlewares/admin/uploadCloud.middleware')

router.get('/', controller.index)
router.get('/:id', controller.detail)
router.post('/create', fileUpload.single('thumbnail'), uploadCloud.upload, controller.create)
router.patch('/delete/:id', controller.delete)
router.patch('/delete-many', controller.deleteMany)
router.patch('/changeStatus/:id', controller.changeStatus)
router.patch('/change-status-many', controller.changeStatusMany)
router.patch('/change-position-many', controller.changePositionMany)
router.patch('/edit/:id', controller.edit)

module.exports = router
