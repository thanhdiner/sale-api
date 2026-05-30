const AppError = require('../../../utils/AppError')
const chatbotConfigService = require('../../../services/admin/chatbot/chatbotConfig.service')

exports.getConfig = async (_req, res, next) => {
  try {
    const result = await chatbotConfigService.getConfig()
    res.json(result)
  } catch (err) {
    return next(err)
  }
}

exports.updateConfig = async (req, res, next) => {
  try {
    const result = await chatbotConfigService.updateConfig(req.body, req.user)
    res.json(result)
  } catch (err) {
    return next(err)
  }
}

exports.getToolLogs = async (req, res, next) => {
  try {
    const result = await chatbotConfigService.getToolLogs(req.query)
    res.json(result)
  } catch (err) {
    return next(err)
  }
}

exports.getRulesDefaults = async (_req, res, next) => {
  try {
    const result = await chatbotConfigService.getRulesDefaults()
    res.json(result)
  } catch (err) {
    return next(err)
  }
}

exports.previewPrompt = async (req, res, next) => {
  try {
    const result = await chatbotConfigService.previewPrompt(req.body)
    res.json(result)
  } catch (err) {
    return next(err)
  }
}

exports.getRulesHistory = async (_req, res, next) => {
  try {
    const result = await chatbotConfigService.getRulesHistory()
    res.json(result)
  } catch (err) {
    return next(err)
  }
}

exports.rollbackRulesHistory = async (req, res, next) => {
  try {
    const result = await chatbotConfigService.rollbackRulesHistory(req.params.id, req.user)
    res.json(result)
  } catch (err) {
    return next(err)
  }
}

exports.testRules = async (req, res, next) => {
  try {
    const result = await chatbotConfigService.testRules(req.body)
    if (!result.success) throw new AppError(result.message || 'Rules test failed', 400, result.data)
    res.json(result)
  } catch (err) {
    return next(err)
  }
}

// POST /api/v1/admin/chatbot-config/test
exports.testConnection = async (req, res, next) => {
  try {
    const result = await chatbotConfigService.testConnection(req.body)
    res.json(result)
  } catch (err) {
    return next(err)
  }
}










