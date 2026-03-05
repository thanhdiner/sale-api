const express = require('express')
const router = express.Router()
const controller = require('../../controllers/admin/reviews.controller')

router.get('/', controller.getReviews)
router.put('/:reviewId/reply', controller.replyReview)
router.delete('/:reviewId/reply', controller.deleteReply)
router.delete('/:reviewId', controller.deleteReview)

module.exports = router
