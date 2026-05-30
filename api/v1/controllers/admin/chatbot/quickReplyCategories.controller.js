const logger = require('../../../../../config/logger')
const quickReplyCategoriesService = require('../../../services/admin/chatbot/quickReplyCategories.service')


module.exports.getCategories = async (req, res, next) => {
  try {
    const result = await quickReplyCategoriesService.listCategories(req.query)
    res.json(result)
  } catch (error) {
    return next(error)
  }
}

module.exports.createCategory = async (req, res, next) => {
  try {
    const result = await quickReplyCategoriesService.createCategory(req.body, req.user)
    res.status(201).json(result)
  } catch (error) {
    return next(error)
  }
}

module.exports.updateCategory = async (req, res, next) => {
  try {
    const result = await quickReplyCategoriesService.updateCategory(req.params.id, req.body, req.user)
    res.json(result)
  } catch (error) {
    return next(error)
  }
}

module.exports.deleteCategory = async (req, res, next) => {
  try {
    const result = await quickReplyCategoriesService.deleteCategory(req.params.id, req.user)
    res.json(result)
  } catch (error) {
    return next(error)
  }
}










