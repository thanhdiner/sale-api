const cron = require('node-cron')
const logger = require('../../../config/logger')
const { runQueuedBlogPublishJob } = require('./blogAutoPublish.job')
const { runBlogAutoDraftJob } = require('./blogAutoDraft.job')

const getPublishSchedule = () => process.env.BLOG_PUBLISH_CHECK_SCHEDULE || '*/15 * * * *'
const getDraftSchedule = () => process.env.BLOG_GENERATION_SCHEDULE || '0 9 * * 1,3,5'

function start() {
  if (process.env.BLOG_AUTO_PUBLISH_ENABLED !== 'false') {
    cron.schedule(getPublishSchedule(), () => {
      runQueuedBlogPublishJob()
    })
    logger.info(`[BlogJobs] Publish queue cron registered: ${getPublishSchedule()}`)
  }

  if (process.env.BLOG_AUTO_DRAFT_ENABLED === 'true') {
    cron.schedule(getDraftSchedule(), () => {
      runBlogAutoDraftJob().catch(error => {
        logger.error('[BlogJobs] Auto draft job failed:', error.stack || error.message || error)
      })
    })
    logger.info(`[BlogJobs] Auto draft cron registered: ${getDraftSchedule()}`)
  }
}

module.exports = {
  start,
  runQueuedBlogPublishJob,
  runBlogAutoDraftJob
}









