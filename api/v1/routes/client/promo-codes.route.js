const express = require('express')
const router = express.Router()
const controller = require('../../controllers/client/promoCodes.controller')

const validate = require('../../middlewares/validate.middleware')
const promoSchemas = require('../../validations/promoCode.validation')

router.get('/', controller.getPromoCodes)
router.post('/validate', validate(promoSchemas.validatePromoCode), controller.validatePromoCode)

module.exports = router

