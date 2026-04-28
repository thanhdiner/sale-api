const express = require('express')
const controller = require('../../controllers/admin/quickReplies.controller')

const router = express.Router()

router.get('/', controller.getQuickReplies)
router.get('/active', controller.getActiveQuickReplies)
router.post('/', controller.createQuickReply)
router.patch('/:id', controller.updateQuickReply)
router.patch('/:id/status', controller.setQuickReplyStatus)
router.patch('/:id/delete', controller.deleteQuickReply)
router.patch('/:id/usage', controller.recordQuickReplyUsage)

module.exports = router
