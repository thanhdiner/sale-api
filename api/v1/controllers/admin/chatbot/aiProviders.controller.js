const logger = require('../../../../../config/logger')
const aiProvidersService = require('../../../services/admin/chatbot/aiProviders.service')

const handleKnownControllerError = (res, error) => {
  if (!error?.statusCode) return false

  res.status(error.statusCode).json({ success: false, message: error.message })
  return true
}

exports.listProviders = async (_req, res) => {
  try {
    const result = await aiProvidersService.listProviders()
    res.json(result)
  } catch (err) {
    logger.error(`[Admin] List AI providers error: ${err.stack || err.message || err}`)
    res.status(500).json({ success: false, message: 'Khong the tai AI providers' })
  }
}

exports.createProvider = async (req, res) => {
  try {
    const result = await aiProvidersService.createProvider(req.body, req.user)
    res.json(result)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error(`[Admin] Create AI provider error: ${err.stack || err.message || err}`)
    res.status(400).json({ success: false, message: err.message || 'Tao AI provider that bai' })
  }
}

exports.updateProvider = async (req, res) => {
  try {
    const result = await aiProvidersService.updateProvider(req.params.id, req.body, req.user)
    res.json(result)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error(`[Admin] Update AI provider error: ${err.stack || err.message || err}`)
    res.status(400).json({ success: false, message: err.message || 'Cap nhat AI provider that bai' })
  }
}

exports.toggleProvider = async (req, res) => {
  try {
    const result = await aiProvidersService.toggleProvider(req.params.id, req.user)
    res.json(result)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error(`[Admin] Toggle AI provider error: ${err.stack || err.message || err}`)
    res.status(400).json({ success: false, message: err.message || 'Cap nhat trang thai provider that bai' })
  }
}

exports.deleteProvider = async (req, res) => {
  try {
    const result = await aiProvidersService.deleteProvider(req.params.id)
    res.json(result)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error(`[Admin] Delete AI provider error: ${err.stack || err.message || err}`)
    res.status(400).json({ success: false, message: err.message || 'Xoa AI provider that bai' })
  }
}

exports.testProvider = async (req, res) => {
  try {
    const result = await aiProvidersService.testProvider(req.params.id, req.body)
    res.status(result.success ? 200 : 400).json(result)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error(`[Admin] Test AI provider error: ${err.stack || err.message || err}`)
    res.status(500).json({ success: false, message: err.message || 'Test provider that bai' })
  }
}
