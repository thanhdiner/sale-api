const express = require('express')
const router = express.Router()
const controller = require('../../../controllers/admin/access/adminAccounts.controller')

const multer = require('multer')
const fileUpload = multer()
const uploadCloud = require('../../../middlewares/upload/uploadCloud.middleware')

const validate = require('../../../middlewares/validation/validate.middleware')
const accountSchemas = require('../../../validations/access/adminAccount.validation')
const parseJsonBodyField = require('../../../utils/parseJsonBodyField')
const checkPermission = require('../../../middlewares/admin/checkPermission.middleware')

const parseAdminAccountJsonBodyFields = (req, res, next) => {
  parseJsonBodyField(req.body, 'translations')
  next()
}

router.get('/', checkPermission.checkPermission('view_accounts'), controller.index)
router.post(
  '/create',
  checkPermission.checkPermission('create_account'),
  fileUpload.single('avatarUrl'),
  uploadCloud.upload,
  parseAdminAccountJsonBodyFields,
  validate(accountSchemas.createAccount),
  controller.create
)
router.patch(
  '/edit/:id',
  checkPermission.checkPermission('edit_account'),
  fileUpload.single('avatarUrl'),
  uploadCloud.deleteImage,
  uploadCloud.upload,
  parseAdminAccountJsonBodyFields,
  validate(accountSchemas.editAccount),
  controller.edit
)
router.patch('/delete/:id', checkPermission.checkPermission('delete_account'), controller.delete)
router.patch(
  '/change-status/:id',
  checkPermission.checkPermission('edit_account'),
  validate(accountSchemas.changeStatus),
  controller.changeStatus
)
router.patch(
  '/update-avatar/:id',
  checkPermission.checkSelfOrPermission('edit_account'),
  fileUpload.single('avatarUrl'),
  uploadCloud.deleteImage,
  uploadCloud.upload,
  validate(accountSchemas.updateAvatar),
  controller.updateAvatar
)
router.patch(
  '/update-profile/:id',
  checkPermission.checkSelfOrPermission('edit_account'),
  validate(accountSchemas.updateProfile),
  controller.updateProfile
)
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












