const express = require('express')
const controller = require('../../../controllers/admin/blog/blogTag.controller')
const checkPermission = require('../../../middlewares/admin/checkPermission.middleware')

const router = express.Router()
const requireAnyPermission = permissions => checkPermission.checkAnyPermission
  ? checkPermission.checkAnyPermission(permissions)
  : checkPermission.checkPermission(permissions[permissions.length - 1])

router.get('/', requireAnyPermission(['cms.tag.view', 'view_blog']), controller.index)
router.post('/', requireAnyPermission(['cms.tag.edit', 'edit_blog']), controller.create)
router.patch('/:id/status', requireAnyPermission(['cms.tag.edit', 'edit_blog']), controller.status)
router.patch('/:id', requireAnyPermission(['cms.tag.edit', 'edit_blog']), controller.update)
router.delete('/:id', requireAnyPermission(['cms.tag.edit', 'edit_blog']), controller.delete)

module.exports = router











