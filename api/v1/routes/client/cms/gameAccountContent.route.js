const express = require('express')
const controller = require('../../../controllers/client/cms/gameAccountContent.controller')

const router = express.Router()

router.get('/', controller.show)

module.exports = router












