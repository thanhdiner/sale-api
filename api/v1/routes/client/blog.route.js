const express = require('express')
const router = express.Router()

const controller = require('../../controllers/client/blog.controller')

router.get('/', controller.index)
router.get('/:slug', controller.show)

module.exports = router
