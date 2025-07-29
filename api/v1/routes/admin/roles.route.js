const express = require('express')
const router = express.Router()

const controller = require('../../controllers/admin/roles.controller')

const checkPermission = require('../../middlewares/admin/checkPermission.middleware')

router.get('/', checkPermission.checkPermission('view_roles'), controller.index)
router.post('/create', checkPermission.checkPermission('create_role'), controller.create)
router.patch('/edit/:id', checkPermission.checkPermission('edit_role'), controller.edit)
router.patch('/delete/:id', checkPermission.checkPermission('delete_role'), controller.delete)
router.patch('/toggle-active/:id', checkPermission.checkPermission('edit_role'), controller.toggleActive)

module.exports = router
