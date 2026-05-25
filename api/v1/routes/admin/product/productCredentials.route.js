const express = require('express')
const router = express.Router()
const controller = require('../../../controllers/admin/product/productCredentials.controller')
const checkPermission = require('../../../middlewares/admin/checkPermission.middleware')

router.get('/product/:productId', checkPermission.checkPermission('view_products'), controller.listByProduct)
router.post('/product/:productId', checkPermission.checkPermission('edit_product'), controller.createMany)
router.get('/:credentialId/reveal', checkPermission.checkPermission('edit_product'), controller.reveal)
router.patch('/:credentialId/disable', checkPermission.checkPermission('edit_product'), controller.disable)

module.exports = router











