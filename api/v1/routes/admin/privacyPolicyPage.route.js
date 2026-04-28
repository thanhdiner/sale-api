const express = require('express')
const controller = require('../../controllers/admin/privacyPolicyPage.controller')
const checkPermission = require('../../middlewares/admin/checkPermission.middleware')

const router = express.Router()

router.get('/', checkPermission.checkPermission('view_privacy_policy'), controller.show)
router.patch('/', checkPermission.checkPermission('edit_privacy_policy'), controller.update)

module.exports = router
