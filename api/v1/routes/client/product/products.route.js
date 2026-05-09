const express = require('express')
const router = express.Router()
const controller = require('../../../controllers/client/product/products.controller')
const authMiddleware = require('../../../middlewares/client/authenticateToken.middleware')
const { createRateLimiter } = require('../../../middlewares/security/rateLimit.middleware')

router.get('/search-suggestions', controller.searchSuggestions)
router.get('/suggest', controller.suggest)
router.get('/recommendations', authMiddleware.optionalAuthenticateToken, controller.recommendations)
router.post('/:id/notify-when-back-in-stock',
  authMiddleware.optionalAuthenticateToken,
  createRateLimiter({ windowMs: 10 * 60 * 1000, max: 5, message: { message: 'Quá nhiều yêu cầu thông báo, vui lòng thử lại sau.' } }),
  controller.notifyWhenBackInStock
)
router.delete('/:id/notify-when-back-in-stock',
  authMiddleware.optionalAuthenticateToken,
  createRateLimiter({ windowMs: 10 * 60 * 1000, max: 5, message: { message: 'Qua nhieu yeu cau thong bao, vui long thu lai sau.' } }),
  controller.unsubscribeWhenBackInStock
)
router.post('/:slug/view',
  authMiddleware.optionalAuthenticateToken,
  createRateLimiter({ windowMs: 60000, max: 30, message: { message: 'Quá nhiều lượt xem, vui lòng thử lại sau.' } }),
  controller.trackView
)
router.get('/:id/explore-more', controller.exploreMore)
router.get('/', controller.index)
router.get('/:slug', controller.detail)

module.exports = router












