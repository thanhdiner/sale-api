const express = require('express')
const controller = require('../../../controllers/client/cms/faqPage.controller')

const router = express.Router()

router.get('/page', controller.show)

module.exports = router












