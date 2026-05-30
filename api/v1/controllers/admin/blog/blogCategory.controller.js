const logger = require('../../../../../config/logger')
const blogCategoryService = require('../../../services/admin/blog/blogCategory.service')


exports.index = async (req, res, next) => {
  try {
    res.status(200).json(await blogCategoryService.listCategories(req.query))
  } catch (err) {
    return next(err)
  }
}

exports.create = async (req, res, next) => {
  try {
    res.status(201).json(await blogCategoryService.createCategory(req.body, req.user))
  } catch (err) {
    return next(err)
  }
}

exports.update = async (req, res, next) => {
  try {
    res.status(200).json(await blogCategoryService.updateCategory(req.params.id, req.body, req.user))
  } catch (err) {
    return next(err)
  }
}

exports.delete = async (req, res, next) => {
  try {
    res.status(200).json(await blogCategoryService.deleteCategory(req.params.id, req.user))
  } catch (err) {
    return next(err)
  }
}










