const { randomUUID } = require('crypto')
const BlogAgentLog = require('../models/blogAgentLog.model')
const logger = require('../../../config/logger')
const { runBlogAgentGenerateDrafts } = require('../services/ai/blogAgent.service')

let isGenerating = false

const createDraftLog = async payload => {
  try {
    await BlogAgentLog.create(payload)
  } catch (error) {
    logger.warn('[BlogAutoDraft] Failed to write log:', error.message)
  }
}

const runBlogAutoDraftJob = async (options = {}) => {
  if (isGenerating) {
    await createDraftLog({
      action: 'generate_drafts_batch_start',
      status: 'skipped',
      reason: 'job_already_running'
    })
    return { createdCount: 0, skipped: true }
  }

  isGenerating = true
  const batchId = options.batchId || `blog_batch_${Date.now()}_${randomUUID().slice(0, 8)}`

  try {
    await createDraftLog({
      batchId,
      action: 'generate_drafts_batch_start',
      status: 'success'
    })

    const result = await runBlogAgentGenerateDrafts({
      batchId,
      postsPerRun: options.postsPerRun || parseInt(process.env.BLOG_AGENT_POSTS_PER_RUN, 10) || 5,
      language: options.language || 'vi',
      generateEnglish: options.generateEnglish ?? true,
      provider: options.provider,
      model: options.model
    })

    await createDraftLog({
      batchId,
      action: 'generate_drafts_batch_done',
      status: 'success',
      output: result
    })

    return result
  } catch (error) {
    logger.error('[BlogAutoDraft] Job failed:', error)
    await createDraftLog({
      batchId,
      action: 'generate_drafts_batch_failed',
      status: 'failed',
      error: error.message
    })

    throw error
  } finally {
    isGenerating = false
  }
}

module.exports = {
  runBlogAutoDraftJob
}
