const logger = require('../../../../../config/logger')
const reviewsService = require('../../../services/admin/commerce/reviews.service')

const handleKnownControllerError = (res, error) => {
  if (!error?.statusCode) {
    return false
  }

  res.status(error.statusCode).json({ error: error.message })
  return true
}

// GET /admin/reviews
module.exports.getReviews = async (req, res) => {
  try {
    const result = await reviewsService.listReviews({
      ...req.query,
      language: req.get('accept-language')
    })
    res.json(result)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error('[Admin] Error getting reviews:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// PUT /admin/reviews/:reviewId/reply
module.exports.replyReview = async (req, res) => {
  try {
    const result = await reviewsService.replyReview(req.params.reviewId, req.body)
    res.json(result)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error('[Admin] Error replying review:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// DELETE /admin/reviews/:reviewId/reply
module.exports.deleteReply = async (req, res) => {
  try {
    const result = await reviewsService.deleteReply(req.params.reviewId)
    res.json(result)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error('[Admin] Error deleting review reply:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// PUT /admin/reviews/:reviewId/hide
module.exports.hideReview = async (req, res) => {
  try {
    const result = await reviewsService.hideReview(req.params.reviewId, req.body, req.user)
    res.json(result)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error('[Admin] Error hiding review:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// DELETE /admin/reviews/:reviewId
module.exports.deleteReview = async (req, res) => {
  try {
    const result = await reviewsService.deleteReview(req.params.reviewId)
    res.json(result)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error('[Admin] Error deleting review:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}










