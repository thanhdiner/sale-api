const express = require('express')
const router = express.Router()
const controller = require('../../controllers/admin/adminAccounts.controller')

const multer = require('multer')
const fileUpload = multer()
const uploadCloud = require('../../middlewares/admin/uploadCloud.middleware')

router.get('/', controller.index)
router.post('/create', fileUpload.single('avatarUrl'), uploadCloud.upload, controller.create)
router.patch('/edit/:id', fileUpload.single('avatarUrl'), uploadCloud.deleteImage, uploadCloud.upload, controller.edit)
router.patch('/delete/:id', controller.delete)
router.patch('/change-status/:id', controller.changeStatus)

module.exports = router
