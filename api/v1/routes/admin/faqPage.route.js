const express = require('express')
const controller = require('../../controllers/admin/faqPage.controller')

const router = express.Router()

router.get('/', controller.show)
router.patch('/', controller.update)

module.exports = router
