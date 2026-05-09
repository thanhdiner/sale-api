const express = require('express')
const controller = require('../../../controllers/admin/blog/blogCategory.controller')
const checkPermission = require('../../../middlewares/admin/checkPermission.middleware')

const router = express.Router()
const requireAnyPermission = permissions => checkPermission.checkAnyPermission
  ? checkPermission.checkAnyPermission(permissions)
  : checkPermission.checkPermission(permissions[permissions.length - 1])

router.get('/', requireAnyPermission(['cms.category.view', 'view_blog']), controller.index)
router.post('/', requireAnyPermission(['cms.category.edit', 'edit_blog']), controller.create)
router.patch('/:id', requireAnyPermission(['cms.category.edit', 'edit_blog']), controller.update)
router.delete('/:id', requireAnyPermission(['cms.category.edit', 'edit_blog']), controller.delete)

module.exports = router











