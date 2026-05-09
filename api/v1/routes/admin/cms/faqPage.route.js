const express = require('express')
const controller = require('../../../controllers/admin/cms/faqPage.controller')
const checkPermission = require('../../../middlewares/admin/checkPermission.middleware')

const router = express.Router()

router.get('/', checkPermission.checkPermission('view_faq'), controller.show)
router.patch('/', checkPermission.checkPermission('edit_faq'), controller.update)

module.exports = router











