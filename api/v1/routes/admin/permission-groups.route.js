const express = require('express')
const router = express.Router()

const controller = require('../../controllers/admin/permission-groups.controller')

const checkPermission = require('../../middlewares/admin/checkPermission.middleware')

router.get('/', checkPermission.checkPermission('view_permission_groups'), controller.index)
router.post('/create', checkPermission.checkPermission('create_permission_group'), controller.create)
router.patch('/edit/:id', checkPermission.checkPermission('edit_permission_group'), controller.edit)
router.patch('/delete/:id', checkPermission.checkPermission('delete_permission_group'), controller.delete)
router.patch('/toggle-active/:id', checkPermission.checkPermission('edit_permission_group'), controller.toggleActive)

module.exports = router
