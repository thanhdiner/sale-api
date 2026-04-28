const express = require('express')
const controller = require('../../controllers/admin/returnPolicyPage.controller')
const checkPermission = require('../../middlewares/admin/checkPermission.middleware')

const router = express.Router()

router.get('/', checkPermission.checkPermission('view_return_policy'), controller.show)
router.patch('/', checkPermission.checkPermission('edit_return_policy'), controller.update)

module.exports = router
