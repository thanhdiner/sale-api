const AppError = require('../../../utils/AppError')
const aiProviderKeysService = require('../../../services/admin/chatbot/aiProviderKeys.service')


exports.getSettings = async (_req, res, next) => {
  try {
    res.json(await aiProviderKeysService.getSettings())
  } catch (err) {
    return next(err)
  }
}

exports.updateSettings = async (req, res, next) => {
  try {
    res.json(await aiProviderKeysService.updateSettings(req.body, req.user))
  } catch (err) {
    return next(err)
  }
}

exports.listKeys = async (req, res, next) => {
  try {
    res.json(await aiProviderKeysService.listKeys(req.query))
  } catch (err) {
    return next(err)
  }
}

exports.createKey = async (req, res, next) => {
  try {
    res.json(await aiProviderKeysService.createKey(req.body, req.user))
  } catch (err) {
    return next(err)
  }
}

exports.updateKey = async (req, res, next) => {
  try {
    res.json(await aiProviderKeysService.updateKey(req.params.id, req.body, req.user))
  } catch (err) {
    return next(err)
  }
}

exports.toggleKey = async (req, res, next) => {
  try {
    res.json(await aiProviderKeysService.toggleKey(req.params.id, req.user))
  } catch (err) {
    return next(err)
  }
}

exports.deleteKey = async (req, res, next) => {
  try {
    res.json(await aiProviderKeysService.deleteKey(req.params.id))
  } catch (err) {
    return next(err)
  }
}

exports.testKey = async (req, res, next) => {
  try {
    const result = await aiProviderKeysService.testKey(req.params.id, req.body)
    if (!result.success) throw new AppError(result.message || 'Test failed', 400, result.data)
    res.json(result)
  } catch (err) {
    return next(err)
  }
}

exports.reorderKey = async (req, res, next) => {
  try {
    res.json(await aiProviderKeysService.reorderKey(req.params.id, req.body?.direction))
  } catch (err) {
    return next(err)
  }
}

exports.listLogs = async (req, res, next) => {
  try {
    res.json(await aiProviderKeysService.listLogs(req.query))
  } catch (err) {
    return next(err)
  }
}
