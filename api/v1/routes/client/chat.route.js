const express = require('express')
const router = express.Router()
const {
  getHistory,
  getConversation,
  getConversations,
  assignConversation,
  resolveConversation,
  reopenConversation,
  markRead
} = require('../../controllers/client/chat.controller')

router.get('/history/:sessionId', getHistory)
router.get('/conversation/:sessionId', getConversation)
router.get('/conversations', getConversations)
router.patch('/assign/:sessionId', assignConversation)
router.patch('/resolve/:sessionId', resolveConversation)
router.patch('/reopen/:sessionId', reopenConversation)
router.patch('/read/:sessionId', markRead)

module.exports = router
