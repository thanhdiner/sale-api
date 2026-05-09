const logger = require('../../../../../config/logger')
const chatbotConfigService = require('../../../services/admin/chatbot/chatbotConfig.service')

const handleKnownControllerError = (res, error) => {
  if (!error?.statusCode) {
    return false
  }

  res.status(error.statusCode).json({
    success: false,
    message: error.message
  })
  return true
}

// GET /api/v1/admin/chatbot-config
exports.getConfig = async (_req, res) => {
  try {
    const result = await chatbotConfigService.getConfig()
    res.json(result)
  } catch (err) {
    logger.error(`[Admin] Get chatbot config error: ${err.stack || err.message || err}`)
    res.status(500).json({ success: false, message: 'Loi server' })
  }
}

// PATCH /api/v1/admin/chatbot-config
exports.updateConfig = async (req, res) => {
  try {
    const result = await chatbotConfigService.updateConfig(req.body, req.user)
    res.json(result)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error(`[Admin] Update chatbot config error: ${err.stack || err.message || err}`)
    res.status(500).json({ success: false, message: err.message || 'Cap nhat cau hinh chatbot that bai!' })
  }
}

// GET /api/v1/admin/chatbot-config/tool-logs
exports.getToolLogs = async (req, res) => {
  try {
    const result = await chatbotConfigService.getToolLogs(req.query)
    res.json(result)
  } catch (err) {
    logger.error(`[Admin] Get tool logs error: ${err.stack || err.message || err}`)
    res.status(500).json({ success: false, message: 'Khong the tai tool logs' })
  }
}

// POST /api/v1/admin/chatbot-config/test
exports.testConnection = async (req, res) => {
  try {
    const result = await chatbotConfigService.testConnection(req.body)
    res.json(result)
  } catch (err) {
    logger.error(`[Admin] Test chatbot connection error: ${err.stack || err.message || err}`)
    res.status(500).json({
      success: false,
      message: `Loi ket noi: ${err.message}`,
      data: { error: err.message }
    })
  }
}










