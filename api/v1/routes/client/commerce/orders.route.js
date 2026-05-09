const express = require('express')
const router = express.Router()
const controller = require('../../../controllers/client/commerce/orders.controller')

const validate = require('../../../middlewares/validation/validate.middleware')
const orderSchemas = require('../../../validations/commerce/order.validation')

router.post('/', validate(orderSchemas.createOrder), controller.createOrder)
router.post('/pending', validate(orderSchemas.createOrder), controller.createPendingOrder)
router.get('/my', controller.getMyOrders)
router.get('/:id', controller.getOrderDetail)
router.post('/cancel/:id', controller.cancelOrder)

module.exports = router













