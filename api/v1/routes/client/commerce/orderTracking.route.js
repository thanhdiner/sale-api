const express = require('express')
const router = express.Router()
const controller = require('../../../controllers/client/commerce/orders.controller')

// POST /api/v1/order-tracking
router.post('/', controller.trackOrder)

module.exports = router












