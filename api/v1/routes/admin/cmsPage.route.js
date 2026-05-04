const express = require('express')
const controller = require('../../controllers/admin/cmsPage.controller')
const checkPermission = require('../../middlewares/admin/checkPermission.middleware')

const router = express.Router()
const requireAnyPermission = permissions => checkPermission.checkAnyPermission
  ? checkPermission.checkAnyPermission(permissions)
  : checkPermission.checkPermission(permissions[permissions.length - 1])

router.post('/publish-due', requireAnyPermission(['cms.page.publish', 'edit_blog']), controller.publishDue)
router.get('/:key', requireAnyPermission(['cms.page.view', 'view_blog']), controller.show)
router.patch('/:key/draft', requireAnyPermission(['cms.page.edit', 'edit_blog']), controller.saveDraft)
router.patch('/:key/schedule', requireAnyPermission(['cms.page.publish', 'edit_blog']), controller.schedule)
router.patch('/:key/publish', requireAnyPermission(['cms.page.publish', 'edit_blog']), controller.publish)

module.exports = router
