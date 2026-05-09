const express = require('express')
const controller = require('../../../controllers/client/cms/returnPolicyPage.controller')

const router = express.Router()

router.get('/page', controller.show)

module.exports = router












