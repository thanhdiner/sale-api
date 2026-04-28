const express = require('express')
const router = express.Router()

const controller = require('../../controllers/admin/cooperationContactContent.controller')
const { invalidateCooperationContactContent } = require('../../middlewares/cacheInvalidation.middleware')

router.get('/', controller.index)
router.patch('/', invalidateCooperationContactContent, controller.edit)

module.exports = router
