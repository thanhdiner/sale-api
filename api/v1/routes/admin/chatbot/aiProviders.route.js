const express = require('express')
const router = express.Router()

const controller = require('../../../controllers/admin/chatbot/aiProviders.controller')
const checkPermission = require('../../../middlewares/admin/checkPermission.middleware')

router.get('/', checkPermission.checkPermission('view_chatbot_config'), controller.listProviders)
router.post('/create', checkPermission.checkPermission('edit_chatbot_config'), controller.createProvider)
router.patch('/update/:id', checkPermission.checkPermission('edit_chatbot_config'), controller.updateProvider)
router.patch('/toggle/:id', checkPermission.checkPermission('edit_chatbot_config'), controller.toggleProvider)
router.post('/test/:id', checkPermission.checkPermission('edit_chatbot_config'), controller.testProvider)
router.delete('/delete/:id', checkPermission.checkPermission('edit_chatbot_config'), controller.deleteProvider)

module.exports = router
