const express = require('express')
const router = express.Router()

const controller = require('../../../controllers/admin/cms/homeWhyChooseUsContent.controller')
const { invalidateHomeWhyChooseUsContent } = require('../../../middlewares/cache/cacheInvalidation.middleware')
const checkPermission = require('../../../middlewares/admin/checkPermission.middleware')

router.get('/', checkPermission.checkPermission('view_home_why_choose_us_content'), controller.index)
router.patch('/', checkPermission.checkPermission('edit_home_why_choose_us_content'), invalidateHomeWhyChooseUsContent, controller.edit)

module.exports = router











