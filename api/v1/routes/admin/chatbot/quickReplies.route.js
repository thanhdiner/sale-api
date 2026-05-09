const express = require('express')
const controller = require('../../../controllers/admin/chatbot/quickReplies.controller')
const checkPermission = require('../../../middlewares/admin/checkPermission.middleware')

const router = express.Router()

router.get('/', checkPermission.checkPermission('view_quick_replies'), controller.getQuickReplies)
router.get('/active', checkPermission.checkPermission('view_quick_replies'), controller.getActiveQuickReplies)
router.post('/', checkPermission.checkPermission('create_quick_reply'), controller.createQuickReply)
router.patch('/:id', checkPermission.checkPermission('edit_quick_reply'), controller.updateQuickReply)
router.patch('/:id/status', checkPermission.checkPermission('edit_quick_reply'), controller.setQuickReplyStatus)
router.patch('/:id/delete', checkPermission.checkPermission('delete_quick_reply'), controller.deleteQuickReply)
router.patch('/:id/usage', checkPermission.checkPermission('view_quick_replies'), controller.recordQuickReplyUsage)

module.exports = router











