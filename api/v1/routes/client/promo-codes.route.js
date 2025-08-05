const express = require('express')
const router = express.Router()
const controller = require('../../controllers/client/promoCodes.controller')

router.get('/', controller.getPromoCodes)
router.post('/validate', controller.validatePromoCode)

module.exports = router
