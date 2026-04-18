const express = require('express')
const router = express.Router()
const controller = require('../../controllers/admin/chatbotConfig.controller')

router.get('/', controller.getConfig)
router.patch('/', controller.updateConfig)
router.post('/test', controller.testConnection)

module.exports = router
