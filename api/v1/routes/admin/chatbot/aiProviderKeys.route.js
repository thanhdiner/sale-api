const express = require('express')
const router = express.Router()

const controller = require('../../../controllers/admin/chatbot/aiProviderKeys.controller')
const checkPermission = require('../../../middlewares/admin/checkPermission.middleware')

router.get('/settings', checkPermission.checkPermission('view_chatbot_config'), controller.getSettings)
router.patch('/settings', checkPermission.checkPermission('edit_chatbot_config'), controller.updateSettings)
router.get('/', checkPermission.checkPermission('view_chatbot_config'), controller.listKeys)
router.get('/logs', checkPermission.checkPermission('view_chatbot_config'), controller.listLogs)
router.post('/create', checkPermission.checkPermission('edit_chatbot_config'), controller.createKey)
router.patch('/update/:id', checkPermission.checkPermission('edit_chatbot_config'), controller.updateKey)
router.patch('/toggle/:id', checkPermission.checkPermission('edit_chatbot_config'), controller.toggleKey)
router.delete('/delete/:id', checkPermission.checkPermission('edit_chatbot_config'), controller.deleteKey)
router.post('/test/:id', checkPermission.checkPermission('edit_chatbot_config'), controller.testKey)
router.patch('/reorder/:id', checkPermission.checkPermission('edit_chatbot_config'), controller.reorderKey)

module.exports = router
