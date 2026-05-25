const express = require('express')
const router = express.Router()

const controller = require('../../../controllers/admin/cms/homeBuildYourKitContent.controller')
const { invalidateHomeBuildYourKitContent } = require('../../../middlewares/cache/cacheInvalidation.middleware')
const checkPermission = require('../../../middlewares/admin/checkPermission.middleware')

router.get('/', checkPermission.checkPermission('view_home_build_your_kit_content'), controller.index)
router.patch('/', checkPermission.checkPermission('edit_home_build_your_kit_content'), invalidateHomeBuildYourKitContent, controller.edit)

module.exports = router

