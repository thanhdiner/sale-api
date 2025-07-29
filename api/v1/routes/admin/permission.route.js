const express = require('express')
const router = express.Router()

const controller = require('../../controllers/admin/permissions.controller')

const checkPermission = require('../../middlewares/admin/checkPermission.middleware')

router.get('/', checkPermission.checkPermission('view_permissions'), controller.index)
router.post('/create', checkPermission.checkPermission('create_permission'), controller.create)
router.patch('/edit/:id', checkPermission.checkPermission('edit_permission'), controller.edit)
router.patch('/delete/:id', checkPermission.checkPermission('delete_permission'), controller.delete)

module.exports = router
