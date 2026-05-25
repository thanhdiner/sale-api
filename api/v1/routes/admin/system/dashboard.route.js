const express = require('express')
const router = express.Router()
const controller = require('../../../controllers/admin/system/dashboard.controller')
const checkPermission = require('../../../middlewares/admin/checkPermission.middleware')

router.get('/summary', checkPermission.checkPermission('view_dashboard'), controller.summary)
router.get('/stats/users', checkPermission.checkPermission('view_dashboard'), controller.userStats)
router.get('/stats/finance', checkPermission.checkPermission('view_dashboard'), controller.financeStats)
router.get('/stats/inventory', checkPermission.checkPermission('view_dashboard'), controller.inventoryStats)
router.get('/charts', checkPermission.checkPermission('view_dashboard'), controller.charts)
router.get('/top-customers', checkPermission.checkPermission('view_dashboard'), controller.topCustomers)
router.get('/recent-orders', checkPermission.checkPermission('view_dashboard'), controller.recentOrders)
router.get('/orders/recent', checkPermission.checkPermission('view_dashboard'), controller.recentOrders)
router.get('/best-selling-products', checkPermission.checkPermission('view_dashboard'), controller.bestSellingProducts)
router.get('/', checkPermission.checkPermission('view_dashboard'), controller.dashboard)

module.exports = router











