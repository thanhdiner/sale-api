const express = require('express')
const router = express.Router()

const controller = require('../../controllers/admin/cooperationContactContent.controller')
const { invalidateCooperationContactContent } = require('../../middlewares/cacheInvalidation.middleware')
const checkPermission = require('../../middlewares/admin/checkPermission.middleware')

router.get('/', checkPermission.checkPermission('view_cooperation_contact_content'), controller.index)
router.patch('/', checkPermission.checkPermission('edit_cooperation_contact_content'), invalidateCooperationContactContent, controller.edit)

module.exports = router
