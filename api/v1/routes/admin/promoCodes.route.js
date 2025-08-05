const express = require('express')
const router = express.Router()

const controller = require('../../controllers/admin/promoCodes.controller')
const checkPermission = require('../../middlewares/admin/checkPermission.middleware')

router.get('/', checkPermission.checkPermission('view_promo_codes'), controller.listPromoCodes)
router.post('/create', checkPermission.checkPermission('create_promo_codes'), controller.createPromoCode)
router.get('/:id', checkPermission.checkPermission('view_promo_codes'), controller.getPromoCode)
router.patch('/update/:id', checkPermission.checkPermission('edit_promo_codes'), controller.updatePromoCode)
router.delete('/delete/:id', checkPermission.checkPermission('delete_promo_codes'), controller.deletePromoCode)

module.exports = router
