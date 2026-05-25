const express = require('express')
const router = express.Router()
const controller = require('../../../controllers/client/commerce/notifications.controller')

router.get('/', controller.getNotifications)
router.patch('/read', controller.markRead)
router.patch('/:id/read', controller.markRead)

module.exports = router
