const express = require('express')
const router = express.Router()

const controller = require('../../controllers/admin/vipContent.controller')

router.get('/', controller.index)
router.patch('/', controller.edit)

module.exports = router
