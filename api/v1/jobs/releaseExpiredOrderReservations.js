const cron = require('node-cron')
const logger = require('../../../config/logger')
const ordersService = require('../services/client/commerce/orders.service')

async function releaseExpiredReservations() {
  try {
    const result = await ordersService.expirePendingOnlineOrders()
    if (result.expiredCount > 0) {
      logger.info(`[OrderReservation] Released ${result.expiredCount} expired online payment orders`)
    }
    return result
  } catch (error) {
    logger.error('[OrderReservation] Release expired reservations error:', error.stack || error.message || error)
    return { success: false, expiredCount: 0, error }
  }
}

function start() {
  setTimeout(() => releaseExpiredReservations(), 15000)
  cron.schedule('*/5 * * * *', () => {
    releaseExpiredReservations()
  })

  logger.info('[OrderReservation] Cron job registered: every 5 minutes')
}

module.exports = {
  start,
  releaseExpiredReservations
}









