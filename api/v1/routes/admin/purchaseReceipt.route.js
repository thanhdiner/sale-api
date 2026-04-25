const express = require('express')
const router = express.Router()

const controller = require('../../controllers/admin/purchaseReceipts.controller')
const checkPermission = require('../../middlewares/admin/checkPermission.middleware')
const { invalidateProducts } = require('../../middlewares/cacheInvalidation.middleware')

router.get('/', checkPermission.checkPermission('view_products'), controller.listPurchaseReceipts)
router.post('/create', checkPermission.checkPermission('edit_product'), invalidateProducts, controller.createPurchaseReceipt)

module.exports = router
