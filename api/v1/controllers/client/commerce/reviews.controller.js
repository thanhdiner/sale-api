const reviewsService = require('../../../services/client/commerce/reviews.service')

const handleKnownError = (res, error) => {
  if (!error?.statusCode) {
    return false
  }

  res.status(error.statusCode).json({ error: error.message })
  return true
}

module.exports.getReviews = async (req, res, next) => {
  try {
    const result = await reviewsService.getReviews({
      productId: req.params.productId,
      query: req.query,
      user: req.user
    })
    res.json(result)
  } catch (err) {
    return next(err)
  }
}

module.exports.createReview = async (req, res, next) => {
  try {
    const result = await reviewsService.createReview({
      productId: req.params.productId,
      body: req.body,
      files: req.files || [],
      user: req.user
    })
    res.status(201).json(result)
  } catch (err) {
    return next(err)
  }
}

module.exports.updateReview = async (req, res, next) => {
  try {
    const result = await reviewsService.updateReview({
      reviewId: req.params.reviewId,
      body: req.body,
      files: req.files || [],
      user: req.user
    })
    res.json(result)
  } catch (err) {
    return next(err)
  }
}

module.exports.deleteReview = async (req, res, next) => {
  try {
    const result = await reviewsService.deleteReview({
      reviewId: req.params.reviewId,
      user: req.user
    })
    res.json(result)
  } catch (err) {
    return next(err)
  }
}

module.exports.voteReview = async (req, res, next) => {
  try {
    const result = await reviewsService.voteReview({
      reviewId: req.params.reviewId,
      user: req.user
    })
    res.json(result)
  } catch (err) {
    return next(err)
  }
}










