const express = require('express')
const router = express.Router()
const controller = require('../../controllers/admin/orders.controller')
const { invalidateDashboard } = require('../../middlewares/cacheInvalidation.middleware')
const checkPermission = require('../../middlewares/admin/checkPermission.middleware')

router.get('/', checkPermission.checkPermission('view_orders'), controller.getAllOrders)
router.get('/:id', checkPermission.checkPermission('view_orders'), controller.getOrderDetailAdmin)
router.patch('/:id', checkPermission.checkPermission('edit_order'), invalidateDashboard, controller.updateOrderStatus)
router.patch('/delete/:id', checkPermission.checkPermission('delete_order'), invalidateDashboard, controller.deleteOrder)

module.exports = router
