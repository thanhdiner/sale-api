const express = require('express')
const router = express.Router()
const controller = require('../../controllers/admin/orders.controller')

router.get('/', controller.getAllOrders)
router.get('/:id', controller.getOrderDetailAdmin)
router.patch('/:id', controller.updateOrderStatus)
router.patch('/delete/:id', controller.deleteOrder)

module.exports = router
