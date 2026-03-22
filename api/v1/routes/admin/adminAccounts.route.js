const express = require('express')
const router = express.Router()
const controller = require('../../controllers/admin/adminAccounts.controller')

const multer = require('multer')
const fileUpload = multer()
const uploadCloud = require('../../middlewares/admin/uploadCloud.middleware')

const validate = require('../../middlewares/validate.middleware')
const accountSchemas = require('../../validations/adminAccount.validation')

router.get('/', controller.index)
router.post('/create', fileUpload.single('avatarUrl'), uploadCloud.upload, validate(accountSchemas.createAccount), controller.create)
router.patch('/edit/:id', fileUpload.single('avatarUrl'), uploadCloud.deleteImage, uploadCloud.upload, validate(accountSchemas.editAccount), controller.edit)
router.patch('/delete/:id', controller.delete)
router.patch('/change-status/:id', validate(accountSchemas.changeStatus), controller.changeStatus)
router.patch('/update-avatar/:id', fileUpload.single('avatarUrl'), uploadCloud.deleteImage, uploadCloud.upload, validate(accountSchemas.updateAvatar), controller.updateAvatar)
router.patch('/update-profile/:id', validate(accountSchemas.updateProfile), controller.updateProfile)
router.patch('/change-password', validate(accountSchemas.changePassword), controller.changePassword)
router.get('/2fa/status', controller.get2FAStatus)
router.post('/2fa/generate', controller.generate2FASecret)
router.post('/2fa/verify', validate(accountSchemas.verify2FACode), controller.verify2FACode)
router.post('/2fa/disable', controller.disable2FA)
router.post('/2fa/backup-codes', controller.regenerateBackupCodes)
router.post('/trusted-devices', validate(accountSchemas.trustDevice), controller.trustDevice)
router.get('/trusted-devices', controller.getTrustedDevices)
router.delete('/trusted-devices/:deviceId', controller.removeTrustedDevice)

module.exports = router

