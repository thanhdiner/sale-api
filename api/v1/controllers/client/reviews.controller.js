const reviewsService = require('../../services/client/reviews.service')

const handleKnownError = (res, error) => {
  if (!error?.statusCode) {
    return false
  }

  res.status(error.statusCode).json({ error: error.message })
  return true
}

module.exports.getReviews = async (req, res) => {
  try {
    const result = await reviewsService.getReviews({
      productId: req.params.productId,
      query: req.query,
      user: req.user
    })
    res.json(result)
  } catch (err) {
    if (handleKnownError(res, err)) return
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

module.exports.createReview = async (req, res) => {
  try {
    const result = await reviewsService.createReview({
      productId: req.params.productId,
      body: req.body,
      files: req.files || [],
      user: req.user
    })
    res.status(201).json(result)
  } catch (err) {
    if (handleKnownError(res, err)) return
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

module.exports.updateReview = async (req, res) => {
  try {
    const result = await reviewsService.updateReview({
      reviewId: req.params.reviewId,
      body: req.body,
      files: req.files || [],
      user: req.user
    })
    res.json(result)
  } catch (err) {
    if (handleKnownError(res, err)) return
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

module.exports.deleteReview = async (req, res) => {
  try {
    const result = await reviewsService.deleteReview({
      reviewId: req.params.reviewId,
      user: req.user
    })
    res.json(result)
  } catch (err) {
    if (handleKnownError(res, err)) return
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

module.exports.voteReview = async (req, res) => {
  try {
    const result = await reviewsService.voteReview({
      reviewId: req.params.reviewId,
      user: req.user
    })
    res.json(result)
  } catch (err) {
    if (handleKnownError(res, err)) return
    console.error(err)
    res.status(500).json({ error: 'Internal server error' })
  }
}
