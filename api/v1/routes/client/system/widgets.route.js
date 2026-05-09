const express = require('express')
const router = express.Router()

const controller = require('../../../controllers/client/system/widgets.controller')

router.get('/', controller.index)

module.exports = router












