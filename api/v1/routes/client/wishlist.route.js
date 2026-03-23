const express = require('express')
const router = express.Router()
const controller = require('../../controllers/client/wishlist.controller')

router.get('/', controller.index)
router.post('/add', controller.add)
router.post('/remove', controller.remove)
router.post('/toggle', controller.toggle)
router.post('/clear', controller.clear)
router.get('/check/:productId', controller.check)

module.exports = router
