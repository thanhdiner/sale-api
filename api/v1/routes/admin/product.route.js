const express = require('express')
const router = express.Router()
const controller = require('../../controllers/admin/products.controller')

router.get('/', controller.index)

// router.get('/:id', controller.detail)

router.post('/create', controller.create)
router.patch('/delete/:id', controller.delete)
router.patch('/delete-many', controller.deleteMany)
router.patch('/changeStatus/:id', controller.changeStatus)
router.patch('/change-status-many', controller.changeStatusMany)

module.exports = router
