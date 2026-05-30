const logger = require('../../../../../config/logger')
const notificationsService = require('../../../services/client/commerce/notifications.service')


module.exports.getNotifications = async (req, res, next) => {
  try {
    const result = await notificationsService.listNotifications(req.user.userId, req.query)
    res.json(result)
  } catch (err) {
    return next(err)
  }
}

module.exports.markRead = async (req, res, next) => {
  try {
    const notificationIds = Array.isArray(req.body?.ids) ? req.body.ids : [req.params.id || req.body?.id].filter(Boolean)
    const result = await notificationsService.markNotificationRead(req.user.userId, {
      notificationIds,
      all: req.body?.all === true
    })
    res.json(result)
  } catch (err) {
    return next(err)
  }
}
