const logger = require('../../../../../config/logger')
const aiRuntimeSettingsService = require('../../../services/admin/chatbot/aiRuntimeSettings.service')

const handleKnownControllerError = (res, error) => {
  if (!error?.statusCode) return false
  res.status(error.statusCode).json({ success: false, message: error.message })
  return true
}

exports.getSettings = async (_req, res) => {
  try {
    const result = await aiRuntimeSettingsService.getSettings()
    res.json(result)
  } catch (err) {
    logger.error(`[Admin] Get AI runtime settings error: ${err.stack || err.message || err}`)
    res.status(500).json({ success: false, message: 'Khong the tai AI runtime settings' })
  }
}

exports.updateSettings = async (req, res) => {
  try {
    const result = await aiRuntimeSettingsService.updateSettings(req.body, req.user)
    res.json(result)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error(`[Admin] Update AI runtime settings error: ${err.stack || err.message || err}`)
    res.status(400).json({ success: false, message: err.message || 'Cap nhat AI runtime settings that bai' })
  }
}

exports.testRuntime = async (req, res) => {
  try {
    const result = await aiRuntimeSettingsService.testRuntime(req.body)
    res.json(result)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error(`[Admin] Test AI runtime error: ${err.stack || err.message || err}`)
    res.status(500).json({ success: false, message: err.message || 'Test runtime that bai' })
  }
}
