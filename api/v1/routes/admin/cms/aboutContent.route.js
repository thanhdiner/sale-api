const express = require('express')
const router = express.Router()

const controller = require('../../../controllers/admin/cms/aboutContent.controller')
const { invalidateAboutContent } = require('../../../middlewares/cache/cacheInvalidation.middleware')
const checkPermission = require('../../../middlewares/admin/checkPermission.middleware')

router.get('/', checkPermission.checkPermission('view_about_content'), controller.index)
router.patch('/', checkPermission.checkPermission('edit_about_content'), invalidateAboutContent, controller.edit)

module.exports = router











