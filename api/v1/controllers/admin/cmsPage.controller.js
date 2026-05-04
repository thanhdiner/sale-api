const logger = require('../../../../config/logger')
const cmsPageService = require('../../services/admin/cmsPage.service')

const handleKnownControllerError = (res, error) => {
  if (!error?.statusCode) return false
  res.status(error.statusCode).json({ message: error.message, details: error.details })
  return true
}

exports.show = async (req, res) => {
  try {
    const result = await cmsPageService.getCmsPage(req.params.key)
    res.status(200).json(result)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error('[Admin] Error fetching CMS page:', err)
    res.status(500).json({ error: 'Failed to fetch CMS page' })
  }
}

exports.saveDraft = async (req, res) => {
  try {
    const result = await cmsPageService.saveDraft(req.params.key, req.body, req.user)
    res.status(200).json(result)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error('[Admin] Error saving CMS page draft:', err)
    res.status(500).json({ error: 'Failed to save CMS page draft' })
  }
}

exports.schedule = async (req, res) => {
  try {
    const result = await cmsPageService.schedulePage(req.params.key, req.body, req.user)
    res.status(200).json(result)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error('[Admin] Error scheduling CMS page:', err)
    res.status(500).json({ error: 'Failed to schedule CMS page' })
  }
}

exports.publishDue = async (req, res) => {
  try {
    const result = await cmsPageService.publishDuePages()
    res.status(200).json(result)
  } catch (err) {
    logger.error('[Admin] Error publishing due CMS pages:', err)
    res.status(500).json({ error: 'Failed to publish due CMS pages' })
  }
}

exports.publish = async (req, res) => {
  try {
    const result = await cmsPageService.publishPage(req.params.key, req.body, req.user)
    res.status(200).json(result)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error('[Admin] Error publishing CMS page:', err)
    res.status(500).json({ error: 'Failed to publish CMS page' })
  }
}
