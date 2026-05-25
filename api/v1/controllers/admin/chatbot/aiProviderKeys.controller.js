const logger = require('../../../../../config/logger')
const aiProviderKeysService = require('../../../services/admin/chatbot/aiProviderKeys.service')

const handleKnownControllerError = (res, error) => {
  if (!error?.statusCode) return false
  res.status(error.statusCode).json({ success: false, message: error.message })
  return true
}

exports.getSettings = async (_req, res) => {
  try {
    res.json(await aiProviderKeysService.getSettings())
  } catch (err) {
    logger.error(`[Admin] Get AI provider key settings error: ${err.stack || err.message || err}`)
    res.status(500).json({ success: false, message: 'Khong the tai key settings' })
  }
}

exports.updateSettings = async (req, res) => {
  try {
    res.json(await aiProviderKeysService.updateSettings(req.body, req.user))
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error(`[Admin] Update AI provider key settings error: ${err.stack || err.message || err}`)
    res.status(400).json({ success: false, message: err.message || 'Cap nhat key settings that bai' })
  }
}

exports.listKeys = async (req, res) => {
  try {
    res.json(await aiProviderKeysService.listKeys(req.query))
  } catch (err) {
    logger.error(`[Admin] List AI provider keys error: ${err.stack || err.message || err}`)
    res.status(500).json({ success: false, message: 'Khong the tai API keys' })
  }
}

exports.createKey = async (req, res) => {
  try {
    res.json(await aiProviderKeysService.createKey(req.body, req.user))
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error(`[Admin] Create AI provider key error: ${err.stack || err.message || err}`)
    res.status(400).json({ success: false, message: err.message || 'Tao API key that bai' })
  }
}

exports.updateKey = async (req, res) => {
  try {
    res.json(await aiProviderKeysService.updateKey(req.params.id, req.body, req.user))
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error(`[Admin] Update AI provider key error: ${err.stack || err.message || err}`)
    res.status(400).json({ success: false, message: err.message || 'Cap nhat API key that bai' })
  }
}

exports.toggleKey = async (req, res) => {
  try {
    res.json(await aiProviderKeysService.toggleKey(req.params.id, req.user))
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error(`[Admin] Toggle AI provider key error: ${err.stack || err.message || err}`)
    res.status(400).json({ success: false, message: err.message || 'Cap nhat trang thai key that bai' })
  }
}

exports.deleteKey = async (req, res) => {
  try {
    res.json(await aiProviderKeysService.deleteKey(req.params.id))
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error(`[Admin] Delete AI provider key error: ${err.stack || err.message || err}`)
    res.status(400).json({ success: false, message: err.message || 'Xoa API key that bai' })
  }
}

exports.testKey = async (req, res) => {
  try {
    const result = await aiProviderKeysService.testKey(req.params.id, req.body)
    res.status(result.success ? 200 : 400).json(result)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error(`[Admin] Test AI provider key error: ${err.stack || err.message || err}`)
    res.status(500).json({ success: false, message: err.message || 'Test API key that bai' })
  }
}

exports.reorderKey = async (req, res) => {
  try {
    res.json(await aiProviderKeysService.reorderKey(req.params.id, req.body?.direction))
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error(`[Admin] Reorder AI provider key error: ${err.stack || err.message || err}`)
    res.status(400).json({ success: false, message: err.message || 'Cap nhat thu tu key that bai' })
  }
}

exports.listLogs = async (req, res) => {
  try {
    res.json(await aiProviderKeysService.listLogs(req.query))
  } catch (err) {
    logger.error(`[Admin] List AI provider key logs error: ${err.stack || err.message || err}`)
    res.status(500).json({ success: false, message: 'Khong the tai key logs' })
  }
}
