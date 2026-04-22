const express = require('express')
const router = express.Router()
const multer = require('multer')
const validate = require('../../middlewares/validate.middleware')
const controller = require('../../controllers/client/reviews.controller')
const reviewSchemas = require('../../validations/review.validation')
const { authenticateToken } = require('../../middlewares/client/authenticateToken.middleware')
const { authenticateTokenOptional } = require('../../middlewares/client/authenticateTokenOptional.middleware')

const fileUpload = multer({ storage: multer.memoryStorage() })

router.get('/:productId', authenticateTokenOptional, validate(reviewSchemas.getReviewsQuery, 'query'), controller.getReviews)
router.post('/:productId', authenticateToken, fileUpload.array('files', 10), validate(reviewSchemas.createReview), controller.createReview)
router.put('/:reviewId', authenticateToken, fileUpload.array('files', 10), validate(reviewSchemas.updateReview), controller.updateReview)
router.delete('/:reviewId', authenticateToken, controller.deleteReview)
router.post('/:reviewId/vote', authenticateToken, controller.voteReview)

module.exports = router
