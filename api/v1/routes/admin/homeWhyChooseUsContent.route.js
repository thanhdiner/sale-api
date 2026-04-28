const express = require('express')
const router = express.Router()

const controller = require('../../controllers/admin/homeWhyChooseUsContent.controller')
const { invalidateHomeWhyChooseUsContent } = require('../../middlewares/cacheInvalidation.middleware')

router.get('/', controller.index)
router.patch('/', invalidateHomeWhyChooseUsContent, controller.edit)

module.exports = router
