const express = require('express')
const router = express.Router()

const controller = require('../../controllers/admin/blogAgent.controller')
const checkPermission = require('../../middlewares/admin/checkPermission.middleware')

const requireAnyPermission = permissions => checkPermission.checkAnyPermission
  ? checkPermission.checkAnyPermission(permissions)
  : checkPermission.checkPermission(permissions[0])

router.post(
  '/generate-drafts',
  requireAnyPermission(['blog.agent.run', 'edit_blog']),
  controller.generateDrafts
)

router.get(
  '/logs',
  requireAnyPermission(['blog.agent.view_logs', 'view_blog']),
  controller.logs
)

router.get(
  '/batches',
  requireAnyPermission(['blog.agent.view_logs', 'view_blog']),
  controller.batches
)

module.exports = router
