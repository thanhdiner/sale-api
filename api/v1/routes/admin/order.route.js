const express = require('express')
const router = express.Router()
const controller = require('../../controllers/admin/orders.controller')
const { invalidateDashboard } = require('../../middlewares/cacheInvalidation.middleware')

router.get('/', controller.getAllOrders)
router.get('/:id', controller.getOrderDetailAdmin)
router.patch('/:id', controller.updateOrderStatus, invalidateDashboard)
router.patch('/delete/:id', controller.deleteOrder, invalidateDashboard)

module.exports = router
