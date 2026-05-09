const logger = require('../../../../../config/logger')
const blogCategoryService = require('../../../services/admin/blog/blogCategory.service')

const handleKnownControllerError = (res, error) => {
  if (!error?.statusCode) return false
  res.status(error.statusCode).json({ message: error.message, details: error.details })
  return true
}

exports.index = async (req, res) => {
  try {
    res.status(200).json(await blogCategoryService.listCategories(req.query))
  } catch (err) {
    logger.error('[Admin] Error fetching blog categories:', err)
    res.status(500).json({ error: 'Failed to fetch blog categories' })
  }
}

exports.create = async (req, res) => {
  try {
    res.status(201).json(await blogCategoryService.createCategory(req.body, req.user))
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error('[Admin] Error creating blog category:', err)
    res.status(500).json({ error: 'Failed to create blog category' })
  }
}

exports.update = async (req, res) => {
  try {
    res.status(200).json(await blogCategoryService.updateCategory(req.params.id, req.body, req.user))
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error('[Admin] Error updating blog category:', err)
    res.status(500).json({ error: 'Failed to update blog category' })
  }
}

exports.delete = async (req, res) => {
  try {
    res.status(200).json(await blogCategoryService.deleteCategory(req.params.id, req.user))
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error('[Admin] Error disabling blog category:', err)
    res.status(500).json({ error: 'Failed to disable blog category' })
  }
}










