const express = require('express')
const router = express.Router()
const controller = require('../../controllers/admin/websiteConfig.controller')

const multer = require('multer')
const fileUpload = multer()

const uploadCloud = require('../../middlewares/admin/uploadCloud.middleware')
const authenticateToken = require('../../middlewares/admin/authenticateToken.middleware')

router.get('/', controller.index)
router.patch(
  '/edit',
  authenticateToken.authenticateToken,
  fileUpload.fields([
    { name: 'logo', maxCount: 1 },
    { name: 'favicon', maxCount: 1 },
    { name: 'dailySuggestionBannerImg', maxCount: 1 }
  ]),
  uploadCloud.deleteImageMany,
  uploadCloud.uploadMany,
  controller.edit
)

module.exports = router
