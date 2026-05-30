const logger = require('../../../../../config/logger')
const reviewsService = require('../../../services/admin/commerce/reviews.service')

// GET /admin/reviews
module.exports.getReviews = async (req, res, next) => {
  try {
    const result = await reviewsService.listReviews({
      ...req.query,
      language: req.get('accept-language')
    })
    res.json(result)
  } catch (err) {
    return next(err)
  }
}

// PUT /admin/reviews/:reviewId/reply
module.exports.replyReview = async (req, res, next) => {
  try {
    const result = await reviewsService.replyReview(req.params.reviewId, req.body)
    res.json(result)
  } catch (err) {
    return next(err)
  }
}

// DELETE /admin/reviews/:reviewId/reply
module.exports.deleteReply = async (req, res, next) => {
  try {
    const result = await reviewsService.deleteReply(req.params.reviewId)
    res.json(result)
  } catch (err) {
    return next(err)
  }
}

// PUT /admin/reviews/:reviewId/hide
module.exports.hideReview = async (req, res, next) => {
  try {
    const result = await reviewsService.hideReview(req.params.reviewId, req.body, req.user)
    res.json(result)
  } catch (err) {
    return next(err)
  }
}

// DELETE /admin/reviews/:reviewId
module.exports.deleteReview = async (req, res, next) => {
  try {
    const result = await reviewsService.deleteReview(req.params.reviewId)
    res.json(result)
  } catch (err) {
    return next(err)
  }
}










