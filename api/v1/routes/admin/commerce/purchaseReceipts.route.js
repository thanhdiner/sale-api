const express = require('express')
const router = express.Router()

const controller = require('../../../controllers/admin/commerce/purchaseReceipts.controller')
const checkPermission = require('../../../middlewares/admin/checkPermission.middleware')
const { invalidateProducts } = require('../../../middlewares/cache/cacheInvalidation.middleware')

router.get('/', checkPermission.checkPermission('view_products'), controller.listPurchaseReceipts)
router.post('/create', checkPermission.checkPermission('edit_product'), invalidateProducts, controller.createPurchaseReceipt)
router.patch('/:id/cancel', checkPermission.checkPermission('edit_product'), invalidateProducts, controller.cancelPurchaseReceipt)

module.exports = router











