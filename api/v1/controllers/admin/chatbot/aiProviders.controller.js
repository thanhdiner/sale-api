const AppError = require('../../../utils/AppError')
const aiProvidersService = require('../../../services/admin/chatbot/aiProviders.service')


exports.listProviders = async (_req, res, next) => {
  try {
    const result = await aiProvidersService.listProviders()
    res.json(result)
  } catch (err) {
    return next(err)
  }
}

exports.createProvider = async (req, res, next) => {
  try {
    const result = await aiProvidersService.createProvider(req.body, req.user)
    res.json(result)
  } catch (err) {
    return next(err)
  }
}

exports.updateProvider = async (req, res, next) => {
  try {
    const result = await aiProvidersService.updateProvider(req.params.id, req.body, req.user)
    res.json(result)
  } catch (err) {
    return next(err)
  }
}

exports.toggleProvider = async (req, res, next) => {
  try {
    const result = await aiProvidersService.toggleProvider(req.params.id, req.user)
    res.json(result)
  } catch (err) {
    return next(err)
  }
}

exports.deleteProvider = async (req, res, next) => {
  try {
    const result = await aiProvidersService.deleteProvider(req.params.id)
    res.json(result)
  } catch (err) {
    return next(err)
  }
}

exports.testProvider = async (req, res, next) => {
  try {
    const result = await aiProvidersService.testProvider(req.params.id, req.body)
    if (!result.success) throw new AppError(result.message || 'Test failed', 400, result.data)
    res.json(result)
  } catch (err) {
    return next(err)
  }
}
