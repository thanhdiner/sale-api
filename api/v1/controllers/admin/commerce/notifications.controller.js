const logger = require('../../../../../config/logger')
const notificationsService = require('../../../services/admin/commerce/notifications.service')

const handleKnownControllerError = (res, error) => {
  if (!error?.statusCode) return false
  res.status(error.statusCode).json({ error: error.message })
  return true
}

module.exports.getNotifications = async (req, res) => {
  try {
    const result = await notificationsService.listNotifications(req.query)
    res.json(result)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error('[Admin] getNotifications error:', err)
    res.status(500).json({ error: 'Loi lay thong bao' })
  }
}

module.exports.markRead = async (req, res) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [req.params.id || req.body?.id].filter(Boolean)
    const result = await notificationsService.markRead({ ids, all: req.body?.all === true })
    res.json(result)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error('[Admin] markNotificationsRead error:', err)
    res.status(500).json({ error: 'Loi cap nhat thong bao' })
  }
}

module.exports.archiveNotifications = async (req, res) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [req.params.id || req.body?.id].filter(Boolean)
    const result = await notificationsService.archiveNotifications(ids)
    res.json(result)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error('[Admin] archiveNotifications error:', err)
    res.status(500).json({ error: 'Loi luu tru thong bao' })
  }
}

module.exports.deleteNotifications = async (req, res) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [req.params.id || req.body?.id].filter(Boolean)
    const result = await notificationsService.deleteNotifications(ids)
    res.json(result)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error('[Admin] deleteNotifications error:', err)
    res.status(500).json({ error: 'Loi xoa thong bao' })
  }
}
