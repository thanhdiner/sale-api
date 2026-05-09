const express = require('express')
const router = express.Router()
const controller = require('../../../controllers/client/commerce/wishlist.controller')
const { createRateLimiter } = require('../../../middlewares/security/rateLimit.middleware')

const wishlistRateLimit = createRateLimiter({ windowMs: 60000, max: 20, message: { message: 'Thao tác wishlist quá nhanh, vui lòng thử lại sau.' } })

router.get('/', controller.index)
router.post('/add', wishlistRateLimit, controller.add)
router.post('/remove', wishlistRateLimit, controller.remove)
router.post('/toggle', wishlistRateLimit, controller.toggle)
router.post('/clear', wishlistRateLimit, controller.clear)
router.get('/check/:productId', controller.check)

module.exports = router












