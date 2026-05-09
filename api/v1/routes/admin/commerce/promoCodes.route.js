const express = require('express')
const router = express.Router()

const controller = require('../../../controllers/admin/commerce/promoCodes.controller')
const checkPermission = require('../../../middlewares/admin/checkPermission.middleware')

const validate = require('../../../middlewares/validation/validate.middleware')
const promoSchemas = require('../../../validations/commerce/promoCode.validation')

router.get('/', checkPermission.checkPermission('view_promo_codes'), controller.listPromoCodes)
router.post('/create', checkPermission.checkPermission('create_promo_codes'), validate(promoSchemas.createPromoCode), controller.createPromoCode)
router.get('/:id', checkPermission.checkPermission('view_promo_codes'), controller.getPromoCode)
router.patch('/update/:id', checkPermission.checkPermission('edit_promo_codes'), validate(promoSchemas.updatePromoCode), controller.updatePromoCode)
router.delete('/delete/:id', checkPermission.checkPermission('delete_promo_codes'), controller.deletePromoCode)

module.exports = router












