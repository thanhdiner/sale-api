const express = require('express')
const controller = require('../../controllers/admin/comingSoonContent.controller')
const checkPermission = require('../../middlewares/admin/checkPermission.middleware')

const router = express.Router()

router.get('/:key', checkPermission.checkPermission('view_coming_soon_content'), controller.show)
router.patch('/:key', checkPermission.checkPermission('edit_coming_soon_content'), controller.update)

module.exports = router
