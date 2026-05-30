const logger = require('../../../../../config/logger')
const aiAgentsService = require('../../../services/admin/chatbot/aiAgents.service')


exports.listAgents = async (_req, res, next) => {
  try {
    res.json(await aiAgentsService.listAgents())
  } catch (err) {
    return next(err)
  }
}

exports.createAgent = async (req, res, next) => {
  try {
    res.json(await aiAgentsService.createAgent(req.body, req.user))
  } catch (err) {
    return next(err)
  }
}

exports.updateAgent = async (req, res, next) => {
  try {
    res.json(await aiAgentsService.updateAgent(req.params.id, req.body, req.user))
  } catch (err) {
    return next(err)
  }
}

exports.toggleAgent = async (req, res, next) => {
  try {
    res.json(await aiAgentsService.toggleAgent(req.params.id, req.user))
  } catch (err) {
    return next(err)
  }
}

exports.deleteAgent = async (req, res, next) => {
  try {
    res.json(await aiAgentsService.deleteAgent(req.params.id))
  } catch (err) {
    return next(err)
  }
}

exports.setDefaultAgent = async (req, res, next) => {
  try {
    res.json(await aiAgentsService.setDefaultAgent(req.params.id))
  } catch (err) {
    return next(err)
  }
}

exports.reorderAgent = async (req, res, next) => {
  try {
    res.json(await aiAgentsService.reorderAgent(req.params.id, req.body?.direction))
  } catch (err) {
    return next(err)
  }
}
