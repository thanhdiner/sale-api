const express = require('express')
const router = express.Router()

const controller = require('../../../controllers/client/blog/blog.controller')

router.get('/', controller.tags)

module.exports = router












