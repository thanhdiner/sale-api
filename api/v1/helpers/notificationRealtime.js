const logger = require('../../../config/logger')
const { getIO } = require('./socket')
const { ROOMS, EVENTS } = require('../socket/constants')

function emitToAudience(audience, userId, event, payload = {}) {
  try {
    const io = getIO()
    const room = audience === 'admin' ? ROOMS.AGENTS : ROOMS.user(userId)
    io.to(room).emit(event, payload)
  } catch (err) {
    logger.warn('[Notifications] Realtime emit skipped:', err?.message || String(err))
  }
}

function emitCreated(notification, stats) {
  const audience = notification?.audience || 'client'
  emitToAudience(audience, notification?.userId, EVENTS.NOTIFICATION_CREATED, { notification, stats })
  if (stats) emitToAudience(audience, notification?.userId, EVENTS.NOTIFICATION_STATS, { stats })
}

function emitRead({ audience, userId, ids = [], all = false, stats }) {
  emitToAudience(audience, userId, EVENTS.NOTIFICATION_READ, { ids, all, stats })
  if (stats) emitToAudience(audience, userId, EVENTS.NOTIFICATION_STATS, { stats })
}

function emitDeleted({ audience, userId, ids = [], stats }) {
  emitToAudience(audience, userId, EVENTS.NOTIFICATION_DELETED, { ids, stats })
  if (stats) emitToAudience(audience, userId, EVENTS.NOTIFICATION_STATS, { stats })
}

module.exports = {
  emitCreated,
  emitRead,
  emitDeleted
}
