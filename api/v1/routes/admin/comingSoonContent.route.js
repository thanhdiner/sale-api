const express = require('express')
const controller = require('../../controllers/admin/comingSoonContent.controller')

const router = express.Router()

router.get('/:key', controller.show)
router.patch('/:key', controller.update)

module.exports = router
