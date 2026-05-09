const express = require('express')
const router = express.Router()
const controller = require('../../../controllers/admin/commerce/reviews.controller')
const checkPermission = require('../../../middlewares/admin/checkPermission.middleware')

router.get('/', checkPermission.checkPermission('view_reviews'), controller.getReviews)
router.put('/:reviewId/reply', checkPermission.checkPermission('reply_review'), controller.replyReview)
router.delete('/:reviewId/reply', checkPermission.checkPermission('reply_review'), controller.deleteReply)
router.put('/:reviewId/hide', checkPermission.checkPermission('edit_review'), controller.hideReview)
router.delete('/:reviewId', checkPermission.checkPermission('delete_review'), controller.deleteReview)

module.exports = router











