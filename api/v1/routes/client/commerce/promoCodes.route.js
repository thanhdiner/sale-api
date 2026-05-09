const express = require('express')
const router = express.Router()
const controller = require('../../../controllers/client/commerce/promoCodes.controller')

const validate = require('../../../middlewares/validation/validate.middleware')
const promoSchemas = require('../../../validations/commerce/promoCode.validation')

router.get('/', controller.getPromoCodes)
router.post('/validate', validate(promoSchemas.validatePromoCode), controller.validatePromoCode)

module.exports = router













