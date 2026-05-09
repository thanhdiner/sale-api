const express = require('express')
const router = express.Router()
const controller = require('../../../controllers/client/commerce/carts.controller')

const validate = require('../../../middlewares/validation/validate.middleware')
const cartSchemas = require('../../../validations/commerce/cart.validation')
const { createRateLimiter } = require('../../../middlewares/security/rateLimit.middleware')

const cartRateLimit = createRateLimiter({ windowMs: 60000, max: 20, message: { message: 'Thao tác giỏ hàng quá nhanh, vui lòng thử lại sau.' } })

router.get('/', controller.index)
router.post('/add', cartRateLimit, validate(cartSchemas.addToCart), controller.add)
router.post('/update', cartRateLimit, validate(cartSchemas.updateCart), controller.update)
router.post('/remove', cartRateLimit, validate(cartSchemas.removeFromCart), controller.remove)
router.post('/clear', cartRateLimit, controller.clear)
router.post('/remove-many', cartRateLimit, validate(cartSchemas.removeManyFromCart), controller.removeMany)

module.exports = router












