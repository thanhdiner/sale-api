const logger = require('../../../../../config/logger')
const aiAgentsService = require('../../../services/admin/chatbot/aiAgents.service')

const handleKnownControllerError = (res, error) => {
  if (!error?.statusCode) return false
  res.status(error.statusCode).json({ success: false, message: error.message })
  return true
}

exports.listAgents = async (_req, res) => {
  try {
    res.json(await aiAgentsService.listAgents())
  } catch (err) {
    logger.error(`[Admin] List AI agents error: ${err.stack || err.message || err}`)
    res.status(500).json({ success: false, message: 'Khong the tai danh sach agent' })
  }
}

exports.createAgent = async (req, res) => {
  try {
    res.json(await aiAgentsService.createAgent(req.body, req.user))
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error(`[Admin] Create AI agent error: ${err.stack || err.message || err}`)
    res.status(400).json({ success: false, message: err.message || 'Tao agent that bai' })
  }
}

exports.updateAgent = async (req, res) => {
  try {
    res.json(await aiAgentsService.updateAgent(req.params.id, req.body, req.user))
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error(`[Admin] Update AI agent error: ${err.stack || err.message || err}`)
    res.status(400).json({ success: false, message: err.message || 'Cap nhat agent that bai' })
  }
}

exports.toggleAgent = async (req, res) => {
  try {
    res.json(await aiAgentsService.toggleAgent(req.params.id, req.user))
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error(`[Admin] Toggle AI agent error: ${err.stack || err.message || err}`)
    res.status(400).json({ success: false, message: err.message || 'Cap nhat trang thai that bai' })
  }
}

exports.deleteAgent = async (req, res) => {
  try {
    res.json(await aiAgentsService.deleteAgent(req.params.id))
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error(`[Admin] Delete AI agent error: ${err.stack || err.message || err}`)
    res.status(400).json({ success: false, message: err.message || 'Xoa agent that bai' })
  }
}

exports.setDefaultAgent = async (req, res) => {
  try {
    res.json(await aiAgentsService.setDefaultAgent(req.params.id))
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error(`[Admin] Set default AI agent error: ${err.stack || err.message || err}`)
    res.status(400).json({ success: false, message: err.message || 'Cap nhat agent mac dinh that bai' })
  }
}

exports.reorderAgent = async (req, res) => {
  try {
    res.json(await aiAgentsService.reorderAgent(req.params.id, req.body?.direction))
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error(`[Admin] Reorder AI agent error: ${err.stack || err.message || err}`)
    res.status(400).json({ success: false, message: err.message || 'Cap nhat thu tu that bai' })
  }
}
