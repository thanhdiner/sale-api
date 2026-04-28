const express = require('express')
const router = express.Router()
const controller = require('../../controllers/admin/websiteConfig.controller')

const multer = require('multer')
const fileUpload = multer()

const uploadCloud = require('../../middlewares/admin/uploadCloud.middleware')
const authenticateTokenModule = require('../../middlewares/admin/authenticateToken.middleware')
const checkPermission = require('../../middlewares/admin/checkPermission.middleware')

const getMiddleware = (moduleValue, name) => {
  if (typeof moduleValue === 'function') {
    return moduleValue
  }

  if (moduleValue && typeof moduleValue === 'object') {
    const fn = Object.values(moduleValue).find(value => typeof value === 'function')

    if (fn) return fn
  }

  throw new Error(`[adminWebsiteConfig.route] ${name} is not a middleware function`)
}

const websiteConfigImageUpload = fileUpload.fields([
  { name: 'logo', maxCount: 1 },
  { name: 'favicon', maxCount: 1 },
  { name: 'dailySuggestionBannerImg', maxCount: 1 }
])

const authMiddleware = getMiddleware(authenticateTokenModule, 'authenticateToken')
const deleteImageManyMiddleware = getMiddleware(uploadCloud.deleteImageMany, 'uploadCloud.deleteImageMany')
const uploadManyMiddleware = getMiddleware(uploadCloud.uploadMany, 'uploadCloud.uploadMany')
const editController = getMiddleware(controller.edit, 'controller.edit')

router.get('/', controller.index)

router.patch(
  '/edit',
  authMiddleware,
  checkPermission.checkPermission('edit_website_config'),
  websiteConfigImageUpload,
  deleteImageManyMiddleware,
  uploadManyMiddleware,
  editController
)

module.exports = router
