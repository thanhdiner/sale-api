const express = require('express')
const router = express.Router()
const controller = require('../../../controllers/admin/product/productContentAssistant.controller')
const checkPermission = require('../../../middlewares/admin/checkPermission.middleware')
const validate = require('../../../middlewares/validation/validate.middleware')
const schemas = require('../../../validations/product/productContentAssistant.validation')

router.post(
  '/generate',
  checkPermission.checkPermission('edit_product'),
  validate(schemas.generate),
  controller.generate
)

module.exports = router











