const logger = require('../../../../config/logger')
const blogTagService = require('../../services/admin/blogTag.service')

const handleKnownControllerError = (res, error) => {
  if (!error?.statusCode) return false
  res.status(error.statusCode).json({ message: error.message, details: error.details })
  return true
}

exports.index = async (req, res) => {
  try {
    res.status(200).json(await blogTagService.listTags(req.query))
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error('[Admin] Error fetching blog tags:', err)
    res.status(500).json({ error: 'Failed to fetch blog tags' })
  }
}

exports.create = async (req, res) => {
  try {
    res.status(201).json(await blogTagService.createTag(req.body, req.user))
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error('[Admin] Error creating blog tag:', err)
    res.status(500).json({ error: 'Failed to create blog tag' })
  }
}

exports.update = async (req, res) => {
  try {
    res.status(200).json(await blogTagService.updateTag(req.params.id, req.body, req.user))
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error('[Admin] Error updating blog tag:', err)
    res.status(500).json({ error: 'Failed to update blog tag' })
  }
}

exports.delete = async (req, res) => {
  try {
    res.status(200).json(await blogTagService.deleteTag(req.params.id, req.user))
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error('[Admin] Error deleting blog tag:', err)
    res.status(500).json({ error: 'Failed to delete blog tag' })
  }
}

exports.status = async (req, res) => {
  try {
    res.status(200).json(await blogTagService.updateTagStatus(req.params.id, req.body.status, req.user))
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error('[Admin] Error updating blog tag status:', err)
    res.status(500).json({ error: 'Failed to update blog tag status' })
  }
}
