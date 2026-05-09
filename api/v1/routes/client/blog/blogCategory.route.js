const express = require('express')
const router = express.Router()

const controller = require('../../../controllers/client/blog/blog.controller')

router.get('/', controller.categories)

module.exports = router












