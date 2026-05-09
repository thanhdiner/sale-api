const express = require('express')
const router = express.Router()
const controller = require('../../../controllers/admin/commerce/flashSales.controller')
const checkPermission = require('../../../middlewares/admin/checkPermission.middleware')

const validate = require('../../../middlewares/validation/validate.middleware')
const fsSchemas = require('../../../validations/commerce/flashSale.validation')

router.get('/', checkPermission.checkPermission('view_flashsales'), controller.index)
router.get('/:id', checkPermission.checkPermission('view_flashsales'), controller.detail)
router.post('/', checkPermission.checkPermission('create_flashsale'), validate(fsSchemas.createFlashSale), controller.create)
router.patch('/:id', checkPermission.checkPermission('edit_flashsale'), validate(fsSchemas.editFlashSale), controller.edit)
router.delete('/delete/:id', checkPermission.checkPermission('delete_flashsale'), controller.delete)
router.patch('/delete-many', checkPermission.checkPermission('delete_flashsale'), validate(fsSchemas.deleteManyFlashSales), controller.deleteMany)
router.patch('/status/:id', checkPermission.checkPermission('edit_flashsale'), validate(fsSchemas.changeFlashSaleStatus), controller.changeStatus)
router.patch('/status-many', checkPermission.checkPermission('edit_flashsale'), validate(fsSchemas.changeStatusMany), controller.changeStatusMany)
router.patch('/positions-many', checkPermission.checkPermission('edit_flashsale'), validate(fsSchemas.changePositionMany), controller.changePositionMany)

module.exports = router












