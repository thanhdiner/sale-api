const logger = require('../../../../../config/logger')
const quickRepliesService = require('../../../services/admin/chatbot/quickReplies.service')


module.exports.getQuickReplies = async (req, res, next) => {
  try {
    const result = await quickRepliesService.listQuickReplies(req.query)
    res.json(result)
  } catch (error) {
    return next(error)
  }
}

module.exports.getActiveQuickReplies = async (req, res, next) => {
  try {
    const result = await quickRepliesService.listActiveQuickReplies(req.query)
    res.json(result)
  } catch (error) {
    return next(error)
  }
}

module.exports.createQuickReply = async (req, res, next) => {
  try {
    const result = await quickRepliesService.createQuickReply(req.body, req.user)
    res.status(201).json(result)
  } catch (error) {
    return next(error)
  }
}

module.exports.updateQuickReply = async (req, res, next) => {
  try {
    const result = await quickRepliesService.updateQuickReply(req.params.id, req.body, req.user)
    res.json(result)
  } catch (error) {
    return next(error)
  }
}

module.exports.setQuickReplyStatus = async (req, res, next) => {
  try {
    const result = await quickRepliesService.setQuickReplyStatus(req.params.id, req.body.isActive, req.user)
    res.json(result)
  } catch (error) {
    return next(error)
  }
}

module.exports.deleteQuickReply = async (req, res, next) => {
  try {
    const result = await quickRepliesService.deleteQuickReply(req.params.id, req.user)
    res.json(result)
  } catch (error) {
    return next(error)
  }
}

module.exports.recordQuickReplyUsage = async (req, res, next) => {
  try {
    const result = await quickRepliesService.recordQuickReplyUsage(req.params.id)
    res.json(result)
  } catch (error) {
    return next(error)
  }
}










