const express = require('express')
const controller = require('../../controllers/admin/contentTranslation.controller')
const checkPermission = require('../../middlewares/admin/checkPermission.middleware')

const router = express.Router()
const requireAnyPermission = permissions => checkPermission.checkAnyPermission
  ? checkPermission.checkAnyPermission(permissions)
  : checkPermission.checkPermission(permissions[permissions.length - 1])

router.post('/to-english', requireAnyPermission(['edit_blog', 'cms.category.edit', 'cms.tag.edit']), controller.translateToEnglish)

module.exports = router
