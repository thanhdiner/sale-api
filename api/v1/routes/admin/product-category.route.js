const express = require('express')
const router = express.Router()
const controller = require('../../controllers/admin/product-categories.controller')

router.get('/', controller.index)
router.patch('/changeStatus/:id', controller.changeStatus)
router.patch('/change-status-many', controller.changeStatusMany)
router.patch('/delete/:id', controller.delete)
router.patch('/delete-many', controller.deleteMany)
router.patch('/change-position-many', controller.changePositionMany)

module.exports = router
