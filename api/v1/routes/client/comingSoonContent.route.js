const express = require('express')
const controller = require('../../controllers/client/comingSoonContent.controller')

const router = express.Router()

router.get('/:key', controller.show)

module.exports = router
