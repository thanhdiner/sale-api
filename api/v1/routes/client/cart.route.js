const express = require('express')
const router = express.Router()
const controller = require('../../controllers/client/carts.controller')

const validate = require('../../middlewares/validate.middleware')
const cartSchemas = require('../../validations/cart.validation')

router.get('/', controller.index)
router.post('/add', validate(cartSchemas.addToCart), controller.add)
router.post('/update', validate(cartSchemas.updateCart), controller.update)
router.post('/remove', validate(cartSchemas.removeFromCart), controller.remove)
router.post('/clear', controller.clear)
router.post('/remove-many', validate(cartSchemas.removeManyFromCart), controller.removeMany)

module.exports = router

