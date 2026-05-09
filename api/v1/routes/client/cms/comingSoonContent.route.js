const express = require('express')
const controller = require('../../../controllers/client/cms/comingSoonContent.controller')

const router = express.Router()

router.get('/:key', controller.show)

module.exports = router












