const express = require('express')
const router = express.Router()
const multer = require('multer')
const controller = require('../../controllers/client/reviews.controller')
const { authenticateToken } = require('../../middlewares/client/authenticateToken.middleware')
const { authenticateTokenOptional } = require('../../middlewares/client/authenticateTokenOptional.middleware')

const fileUpload = multer({ storage: multer.memoryStorage() })

// Public – read reviews (auth optional, used to mark isVoted/isOwner)
router.get('/:productId', authenticateTokenOptional, controller.getReviews)

// Auth required
router.post('/:productId', authenticateToken, fileUpload.array('files', 10), controller.createReview)
router.put('/:reviewId', authenticateToken, fileUpload.array('files', 10), controller.updateReview)
router.delete('/:reviewId', authenticateToken, controller.deleteReview)
router.post('/:reviewId/vote', authenticateToken, controller.voteReview)

module.exports = router
