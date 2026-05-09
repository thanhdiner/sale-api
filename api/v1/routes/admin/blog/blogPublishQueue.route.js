const express = require('express')
const router = express.Router()

const controller = require('../../../controllers/admin/blog/blog.controller')
const checkPermission = require('../../../middlewares/admin/checkPermission.middleware')

const requireAnyPermission = permissions => checkPermission.checkAnyPermission
  ? checkPermission.checkAnyPermission(permissions)
  : checkPermission.checkPermission(permissions[0])

router.get('/', requireAnyPermission(['blog.publish', 'view_blog']), controller.publishQueue)

module.exports = router











