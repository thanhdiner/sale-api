const logger = require('../../../../config/logger')
const quickReplyCategoriesService = require('../../services/admin/quickReplyCategories.service')

function handleKnownControllerError(res, error) {
  if (!error?.statusCode) {
    return false
  }

  const payload = { error: error.message }
  if (error.details) {
    payload.detail = error.details
  }

  res.status(error.statusCode).json(payload)
  return true
}

module.exports.getCategories = async (req, res) => {
  try {
    const result = await quickReplyCategoriesService.listCategories(req.query)
    res.json(result)
  } catch (error) {
    if (handleKnownControllerError(res, error)) return
    logger.error('[Admin] getQuickReplyCategories error:', error)
    res.status(500).json({ error: 'Failed to load quick reply categories' })
  }
}

module.exports.createCategory = async (req, res) => {
  try {
    const result = await quickReplyCategoriesService.createCategory(req.body, req.user)
    res.status(201).json(result)
  } catch (error) {
    if (handleKnownControllerError(res, error)) return
    logger.error('[Admin] createQuickReplyCategory error:', error)
    res.status(500).json({ error: 'Failed to create quick reply category' })
  }
}

module.exports.updateCategory = async (req, res) => {
  try {
    const result = await quickReplyCategoriesService.updateCategory(req.params.id, req.body, req.user)
    res.json(result)
  } catch (error) {
    if (handleKnownControllerError(res, error)) return
    logger.error('[Admin] updateQuickReplyCategory error:', error)
    res.status(500).json({ error: 'Failed to update quick reply category' })
  }
}

module.exports.deleteCategory = async (req, res) => {
  try {
    const result = await quickReplyCategoriesService.deleteCategory(req.params.id, req.user)
    res.json(result)
  } catch (error) {
    if (handleKnownControllerError(res, error)) return
    logger.error('[Admin] deleteQuickReplyCategory error:', error)
    res.status(500).json({ error: 'Failed to delete quick reply category' })
  }
}
