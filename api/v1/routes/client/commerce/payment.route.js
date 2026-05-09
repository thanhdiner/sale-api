const express = require('express')
const router = express.Router()
const controller = require('../../../controllers/client/commerce/payment.controller')
const { authenticateToken } = require('../../../middlewares/client/authenticateToken.middleware')

// VNPay
router.post('/vnpay/create', authenticateToken, controller.createVNPayUrl)
router.get('/vnpay/return', controller.vnpayReturn) // VNPay redirect GET

// MoMo
router.post('/momo/create', authenticateToken, controller.createMoMoUrl)
router.post('/momo/callback', controller.momoCallback) // IPN không cần auth

// ZaloPay
router.post('/zalopay/create', authenticateToken, controller.createZaloPayUrl)
router.post('/zalopay/callback', controller.zalopayCallback) // IPN không cần auth

module.exports = router












