const express = require('express')
const router = express.Router()
const controller = require('../../controllers/admin/productCredentials.controller')
const checkPermission = require('../../middlewares/admin/checkPermission.middleware')
const { invalidateProducts } = require('../../middlewares/cacheInvalidation.middleware')

router.get('/product/:productId', checkPermission.checkPermission('view_products'), controller.listByProduct)
router.post('/product/:productId', checkPermission.checkPermission('edit_product'), invalidateProducts, controller.createMany)
router.get('/:credentialId/reveal', checkPermission.checkPermission('edit_product'), controller.reveal)
router.patch('/:credentialId/disable', checkPermission.checkPermission('edit_product'), invalidateProducts, controller.disable)

module.exports = router
