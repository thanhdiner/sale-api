const express = require('express')
const controller = require('../../controllers/client/cmsPage.controller')

const router = express.Router()

router.get('/:key', controller.show)

module.exports = router
