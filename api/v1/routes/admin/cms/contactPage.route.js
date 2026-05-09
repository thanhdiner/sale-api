const express = require('express')
const controller = require('../../../controllers/admin/cms/contactPage.controller')
const checkPermission = require('../../../middlewares/admin/checkPermission.middleware')

const router = express.Router()

router.get('/', checkPermission.checkPermission('view_contact_page'), controller.show)
router.patch('/', checkPermission.checkPermission('edit_contact_page'), controller.update)

module.exports = router











