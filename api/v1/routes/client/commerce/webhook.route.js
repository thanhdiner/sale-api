const express = require('express')
const controller = require('../../../controllers/client/commerce/webhook.controller')

const router = express.Router()

router.post('/sepay', controller.sepayWebhook)

module.exports = router












