const logger = require('../../../../../config/logger')
const aiRuntimeSettingsService = require('../../../services/admin/chatbot/aiRuntimeSettings.service')


exports.getSettings = async (_req, res, next) => {
  try {
    const result = await aiRuntimeSettingsService.getSettings()
    res.json(result)
  } catch (err) {
    return next(err)
  }
}

exports.updateSettings = async (req, res, next) => {
  try {
    const result = await aiRuntimeSettingsService.updateSettings(req.body, req.user)
    res.json(result)
  } catch (err) {
    return next(err)
  }
}

exports.testRuntime = async (req, res, next) => {
  try {
    const result = await aiRuntimeSettingsService.testRuntime(req.body)
    res.json(result)
  } catch (err) {
    return next(err)
  }
}
