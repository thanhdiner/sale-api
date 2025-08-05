const express = require('express')
const router = express.Router()
const controller = require('../../controllers/client/orders.controller')

router.post('/', controller.createOrder)
router.get('/my', controller.getMyOrders)
router.get('/:id', controller.getOrderDetail)
router.post('/cancel/:id', controller.cancelOrder)

module.exports = router
