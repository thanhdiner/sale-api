const express = require('express')
const router = express.Router()
const controller = require('../../controllers/client/product-categories.controller')

router.get('/tree', controller.index)

module.exports = router
