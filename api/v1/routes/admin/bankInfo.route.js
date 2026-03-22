const express = require('express')
const router = express.Router()
const controller = require('../../controllers/admin/bankInfo.controller')

const multer = require('multer')
const fileUpload = multer()
const uploadCloud = require('../../middlewares/admin/uploadCloud.middleware')

const checkPermission = require('../../middlewares/admin/checkPermission.middleware')
const { invalidateBankInfo } = require('../../middlewares/cacheInvalidation.middleware')

router.get('/', checkPermission.checkPermission('view_bank_info'), controller.getAllBankInfos)
router.get('/active', checkPermission.checkPermission('view_bank_info'), controller.getActiveBankInfo)
router.post(
  '/',
  checkPermission.checkPermission('create_bank_info'),
  fileUpload.single('qrCode'),
  uploadCloud.upload,
  controller.createBankInfo,
  invalidateBankInfo
)
router.patch(
  '/:id',
  checkPermission.checkPermission('edit_bank_info'),
  fileUpload.single('qrCode'),
  uploadCloud.deleteImage,
  uploadCloud.upload,
  controller.updateBankInfo,
  invalidateBankInfo
)
router.patch('/:id/delete', checkPermission.checkPermission('delete_bank_info'), controller.deleteBankInfo, invalidateBankInfo)
router.patch('/:id/activate', checkPermission.checkPermission('edit_bank_info'), controller.activateBankInfo, invalidateBankInfo)

module.exports = router
