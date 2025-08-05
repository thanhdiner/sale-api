const express = require('express')
const router = express.Router()
const controller = require('../../controllers/client/products.controller')

router.get('/suggest', controller.suggest)
router.get('/', controller.index)
router.get('/:slug', controller.detail)

module.exports = router
