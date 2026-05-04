const express = require('express')
const router = express.Router()
const controller = require('../../controllers/admin/productContentAssistant.controller')
const checkPermission = require('../../middlewares/admin/checkPermission.middleware')
const validate = require('../../middlewares/validate.middleware')
const schemas = require('../../validations/productContentAssistant.validation')

router.post(
  '/generate',
  checkPermission.checkPermission('edit_product'),
  validate(schemas.generate),
  controller.generate
)

module.exports = router
