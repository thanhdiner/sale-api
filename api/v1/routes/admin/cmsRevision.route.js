const express = require('express')
const controller = require('../../controllers/admin/cmsRevision.controller')
const checkPermission = require('../../middlewares/admin/checkPermission.middleware')

const router = express.Router()
const requireAnyPermission = permissions => checkPermission.checkAnyPermission
  ? checkPermission.checkAnyPermission(permissions)
  : checkPermission.checkPermission(permissions[permissions.length - 1])

router.get('/', requireAnyPermission(['cms.revision.view', 'view_blog']), controller.index)
router.post('/:id/restore', requireAnyPermission(['cms.revision.restore', 'edit_blog']), controller.restore)

module.exports = router
