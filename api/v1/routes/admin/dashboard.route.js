const express = require('express')
const router = express.Router()
const controller = require('../../controllers/admin/dashboard.controller')

router.get('/summary', controller.summary)
router.get('/charts', controller.charts)
router.get('/top-customers', controller.topCustomers)
router.get('/recent-orders', controller.recentOrders)
router.get('/orders/recent', controller.recentOrders)
router.get('/best-selling-products', controller.bestSellingProducts)
router.get('/', controller.dashboard)

module.exports = router
