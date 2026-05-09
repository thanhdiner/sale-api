const express = require('express')
const router = express.Router()
const controller = require('../../../controllers/client/product/productCategories.controller')

router.get('/tree', controller.index)
router.get('/:slug/products', controller.getProductsByCategorySlug)

module.exports = router












