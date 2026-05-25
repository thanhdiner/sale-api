const express = require('express')
const router = express.Router()
const controller = require('../../../controllers/admin/commerce/notifications.controller')

router.get('/', controller.getNotifications)
router.patch('/read', controller.markRead)
router.patch('/:id/read', controller.markRead)
router.patch('/archive', controller.archiveNotifications)
router.patch('/:id/archive', controller.archiveNotifications)
router.delete('/', controller.deleteNotifications)
router.delete('/:id', controller.deleteNotifications)

module.exports = router
