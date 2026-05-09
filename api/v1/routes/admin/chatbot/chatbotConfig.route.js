const express = require('express')
const router = express.Router()
const controller = require('../../../controllers/admin/chatbot/chatbotConfig.controller')
const checkPermission = require('../../../middlewares/admin/checkPermission.middleware')

router.get('/', checkPermission.checkPermission('view_chatbot_config'), controller.getConfig)
router.get('/tool-logs', checkPermission.checkPermission('view_chatbot_tool_logs'), controller.getToolLogs)
router.patch('/', checkPermission.checkPermission('edit_chatbot_config'), controller.updateConfig)
router.post('/test', checkPermission.checkPermission('edit_chatbot_config'), controller.testConnection)

module.exports = router











