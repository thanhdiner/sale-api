const express = require('express')
const controller = require('../../controllers/admin/footerContent.controller')
const checkPermission = require('../../middlewares/admin/checkPermission.middleware')

const router = express.Router()

router.get('/', checkPermission.checkPermission('view_footer_content'), controller.show)
router.patch('/', checkPermission.checkPermission('edit_footer_content'), controller.update)

module.exports = router
