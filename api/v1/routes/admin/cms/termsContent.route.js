const express = require('express')
const router = express.Router()

const controller = require('../../../controllers/admin/cms/termsContent.controller')
const { invalidateTermsContent } = require('../../../middlewares/cache/cacheInvalidation.middleware')
const checkPermission = require('../../../middlewares/admin/checkPermission.middleware')

router.get('/', checkPermission.checkPermission('view_terms_content'), controller.index)
router.patch('/', checkPermission.checkPermission('edit_terms_content'), invalidateTermsContent, controller.edit)

module.exports = router











