const express = require('express')
const router = express.Router()
const controller = require('../../controllers/admin/products.controller')

router.get('/', controller.index)

// router.get('/:id', controller.detail)
router.get('/:id', controller.detail) // Assuming you want to get product by ID
router.post('/create', controller.create)
router.patch('/delete/:id', controller.delete)
router.patch('/delete-many', controller.deleteMany)
router.patch('/changeStatus/:id', controller.changeStatus)
router.patch('/change-status-many', controller.changeStatusMany)
router.patch('/change-position-many', controller.changePositionMany)
router.patch('/edit/:id', controller.edit)

module.exports = router
