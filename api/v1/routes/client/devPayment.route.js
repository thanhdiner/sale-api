const express = require('express')
const controller = require('../../controllers/client/devPayment.controller')

const router = express.Router()

router.post('/simulate-sepay/:orderCode', controller.simulateSepayPayment)

module.exports = router
