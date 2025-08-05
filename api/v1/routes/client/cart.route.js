const express = require('express')
const router = express.Router()
const controller = require('../../controllers/client/carts.controller')

router.get('/', controller.index)
router.post('/add', controller.add)
router.post('/update', controller.update)
router.post('/remove', controller.remove)
router.post('/clear', controller.clear)
router.post('/remove-many', controller.removeMany)

module.exports = router
