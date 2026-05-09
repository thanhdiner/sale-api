const logger = require('../../../../../config/logger')
const quickRepliesService = require('../../../services/admin/chatbot/quickReplies.service')

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

module.exports.getQuickReplies = async (req, res) => {
  try {
    const result = await quickRepliesService.listQuickReplies(req.query)
    res.json(result)
  } catch (error) {
    if (handleKnownControllerError(res, error)) return
    logger.error('[Admin] getQuickReplies error:', error)
    res.status(500).json({ error: 'Failed to load quick replies' })
  }
}

module.exports.getActiveQuickReplies = async (req, res) => {
  try {
    const result = await quickRepliesService.listActiveQuickReplies(req.query)
    res.json(result)
  } catch (error) {
    if (handleKnownControllerError(res, error)) return
    logger.error('[Admin] getActiveQuickReplies error:', error)
    res.status(500).json({ error: 'Failed to load active quick replies' })
  }
}

module.exports.createQuickReply = async (req, res) => {
  try {
    const result = await quickRepliesService.createQuickReply(req.body, req.user)
    res.status(201).json(result)
  } catch (error) {
    if (handleKnownControllerError(res, error)) return
    logger.error('[Admin] createQuickReply error:', error)
    res.status(500).json({ error: 'Failed to create quick reply' })
  }
}

module.exports.updateQuickReply = async (req, res) => {
  try {
    const result = await quickRepliesService.updateQuickReply(req.params.id, req.body, req.user)
    res.json(result)
  } catch (error) {
    if (handleKnownControllerError(res, error)) return
    logger.error('[Admin] updateQuickReply error:', error)
    res.status(500).json({ error: 'Failed to update quick reply' })
  }
}

module.exports.setQuickReplyStatus = async (req, res) => {
  try {
    const result = await quickRepliesService.setQuickReplyStatus(req.params.id, req.body.isActive, req.user)
    res.json(result)
  } catch (error) {
    if (handleKnownControllerError(res, error)) return
    logger.error('[Admin] setQuickReplyStatus error:', error)
    res.status(500).json({ error: 'Failed to update quick reply status' })
  }
}

module.exports.deleteQuickReply = async (req, res) => {
  try {
    const result = await quickRepliesService.deleteQuickReply(req.params.id, req.user)
    res.json(result)
  } catch (error) {
    if (handleKnownControllerError(res, error)) return
    logger.error('[Admin] deleteQuickReply error:', error)
    res.status(500).json({ error: 'Failed to delete quick reply' })
  }
}

module.exports.recordQuickReplyUsage = async (req, res) => {
  try {
    const result = await quickRepliesService.recordQuickReplyUsage(req.params.id)
    res.json(result)
  } catch (error) {
    if (handleKnownControllerError(res, error)) return
    logger.error('[Admin] recordQuickReplyUsage error:', error)
    res.status(500).json({ error: 'Failed to record quick reply usage' })
  }
}










