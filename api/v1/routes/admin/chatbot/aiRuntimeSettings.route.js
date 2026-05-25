const express = require('express')
const router = express.Router()

const controller = require('../../../controllers/admin/chatbot/aiRuntimeSettings.controller')
const checkPermission = require('../../../middlewares/admin/checkPermission.middleware')

router.get('/', checkPermission.checkPermission('view_chatbot_config'), controller.getSettings)
router.patch('/', checkPermission.checkPermission('edit_chatbot_config'), controller.updateSettings)
router.post('/test', checkPermission.checkPermission('edit_chatbot_config'), controller.testRuntime)

module.exports = router
