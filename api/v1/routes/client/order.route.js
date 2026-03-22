const express = require('express')
const router = express.Router()
const controller = require('../../controllers/client/orders.controller')

const validate = require('../../middlewares/validate.middleware')
const orderSchemas = require('../../validations/order.validation')

router.post('/', validate(orderSchemas.createOrder), controller.createOrder)
router.post('/pending', controller.createPendingOrder)
router.get('/my', controller.getMyOrders)
router.get('/:id', controller.getOrderDetail)
router.post('/cancel/:id', controller.cancelOrder)

module.exports = router

