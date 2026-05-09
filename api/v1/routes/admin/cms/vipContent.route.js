const express = require('express')
const router = express.Router()

const controller = require('../../../controllers/admin/cms/vipContent.controller')
const checkPermission = require('../../../middlewares/admin/checkPermission.middleware')

router.get('/', checkPermission.checkPermission('view_vip_content'), controller.index)
router.patch('/', checkPermission.checkPermission('edit_vip_content'), controller.edit)

module.exports = router











