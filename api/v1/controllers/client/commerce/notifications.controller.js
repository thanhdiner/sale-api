const logger = require('../../../../../config/logger')
const notificationsService = require('../../../services/client/commerce/notifications.service')

const handleKnownControllerError = (res, error) => {
  if (!error?.statusCode) return false
  res.status(error.statusCode).json({ error: error.message })
  return true
}

module.exports.getNotifications = async (req, res) => {
  try {
    const result = await notificationsService.listNotifications(req.user.userId, req.query)
    res.json(result)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error('[Client] getNotifications error:', err)
    res.status(500).json({ error: 'Loi lay thong bao' })
  }
}

module.exports.markRead = async (req, res) => {
  try {
    const notificationIds = Array.isArray(req.body?.ids) ? req.body.ids : [req.params.id || req.body?.id].filter(Boolean)
    const result = await notificationsService.markNotificationRead(req.user.userId, {
      notificationIds,
      all: req.body?.all === true
    })
    res.json(result)
  } catch (err) {
    if (handleKnownControllerError(res, err)) return
    logger.error('[Client] markNotificationsRead error:', err)
    res.status(500).json({ error: 'Loi cap nhat thong bao' })
  }
}
