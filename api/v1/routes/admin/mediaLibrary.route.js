const express = require('express')
const controller = require('../../controllers/admin/mediaLibrary.controller')
const checkPermission = require('../../middlewares/admin/checkPermission.middleware')

const router = express.Router()
const requireAnyPermission = permissions => checkPermission.checkAnyPermission
  ? checkPermission.checkAnyPermission(permissions)
  : checkPermission.checkPermission(permissions[permissions.length - 1])

router.get('/', requireAnyPermission(['cms.media.view', 'view_blog']), controller.index)
router.patch('/:id', requireAnyPermission(['cms.media.edit', 'edit_blog']), controller.update)
router.delete('/:id', requireAnyPermission(['cms.media.edit', 'edit_blog']), controller.delete)

module.exports = router
