const express = require('express')
const router = express.Router()
const controller = require('../../controllers/admin/products.controller')

router.get('/', controller.index)

// router.get('/:id', controller.detail)

router.post('/create', controller.create)
router.patch('/delete/:id', controller.delete)

module.exports = router
