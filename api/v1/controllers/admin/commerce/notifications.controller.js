const logger = require('../../../../../config/logger')
const notificationsService = require('../../../services/admin/commerce/notifications.service')


module.exports.getNotifications = async (req, res, next) => {
  try {
    const result = await notificationsService.listNotifications(req.query)
    res.json(result)
  } catch (err) {
    return next(err)
  }
}

module.exports.markRead = async (req, res, next) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [req.params.id || req.body?.id].filter(Boolean)
    const result = await notificationsService.markRead({ ids, all: req.body?.all === true })
    res.json(result)
  } catch (err) {
    return next(err)
  }
}

module.exports.archiveNotifications = async (req, res, next) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [req.params.id || req.body?.id].filter(Boolean)
    const result = await notificationsService.archiveNotifications(ids)
    res.json(result)
  } catch (err) {
    return next(err)
  }
}

module.exports.deleteNotifications = async (req, res, next) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [req.params.id || req.body?.id].filter(Boolean)
    const result = await notificationsService.deleteNotifications(ids)
    res.json(result)
  } catch (err) {
    return next(err)
  }
}
