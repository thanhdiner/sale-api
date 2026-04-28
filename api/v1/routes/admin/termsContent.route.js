const express = require('express')
const router = express.Router()

const controller = require('../../controllers/admin/termsContent.controller')
const { invalidateTermsContent } = require('../../middlewares/cacheInvalidation.middleware')

router.get('/', controller.index)
router.patch('/', invalidateTermsContent, controller.edit)

module.exports = router
