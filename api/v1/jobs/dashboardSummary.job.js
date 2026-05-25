const cron = require('node-cron')
const logger = require('../../../config/logger')
const dashboardService = require('../services/admin/system/dashboard.service')

const DEFAULT_SCHEDULE = '*/5 * * * *'

function getSchedule() {
  return process.env.DASHBOARD_SUMMARY_CRON || DEFAULT_SCHEDULE
}

function start() {
  cron.schedule(getSchedule(), async () => {
    try {
      await dashboardService.warmDashboardCache()
      logger.info('[DashboardJob] Dashboard cache warmed')
    } catch (err) {
      logger.error('[DashboardJob] Warm cache failed:', err?.message || String(err))
    }
  })

  logger.info(`[DashboardJob] Summary cron registered: ${getSchedule()}`)
}

module.exports = { start }
