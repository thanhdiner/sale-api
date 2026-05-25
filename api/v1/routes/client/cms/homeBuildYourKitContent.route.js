const express = require('express')
const router = express.Router()

const controller = require('../../../controllers/client/cms/homeBuildYourKitContent.controller')

router.get('/', controller.index)

module.exports = router

