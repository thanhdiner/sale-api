const express = require('express')
const router = express.Router()
const controller = require('../../controllers/admin/flashSales.controller')
const checkPermission = require('../../middlewares/admin/checkPermission.middleware')

router.get('/', checkPermission.checkPermission('view_flashsales'), controller.index)
router.get('/:id', checkPermission.checkPermission('view_flashsales'), controller.detail)
router.post('/', checkPermission.checkPermission('create_flashsale'), controller.create)
router.patch('/:id', checkPermission.checkPermission('edit_flashsale'), controller.edit)
router.delete('/delete/:id', checkPermission.checkPermission('delete_flashsale'), controller.delete)
router.patch('/delete-many', checkPermission.checkPermission('delete_flashsale'), controller.deleteMany)
router.patch('/status/:id', checkPermission.checkPermission('edit_flashsale'), controller.changeStatus)
router.patch('/status-many', checkPermission.checkPermission('edit_flashsale'), controller.changeStatusMany)
router.patch('/positions-many', checkPermission.checkPermission('edit_flashsale'), controller.changePositionMany)

module.exports = router
