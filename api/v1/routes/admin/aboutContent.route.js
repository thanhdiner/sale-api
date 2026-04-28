const express = require('express')
const router = express.Router()

const controller = require('../../controllers/admin/aboutContent.controller')
const { invalidateAboutContent } = require('../../middlewares/cacheInvalidation.middleware')

router.get('/', controller.index)
router.patch('/', invalidateAboutContent, controller.edit)

module.exports = router
