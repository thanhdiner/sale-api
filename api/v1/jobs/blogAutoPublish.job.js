const BlogPost = require('../models/blogPost.model')
const BlogAgentLog = require('../models/blogAgentLog.model')
const cache = require('../../../config/redis')
const logger = require('../../../config/logger')

const getMaxPostsPerDay = () => Math.max(parseInt(process.env.BLOG_MAX_POSTS_PER_DAY, 10) || 2, 1)
const shouldRequireEnglishTranslation = () => process.env.BLOG_REQUIRE_ENGLISH_TRANSLATION !== 'false'
const shouldBlockHighDuplicateRisk = () => process.env.BLOG_BLOCK_HIGH_DUPLICATE_RISK !== 'false'

let isPublishing = false

const hasRequiredContent = post => {
  if (!post.title || !post.excerpt || !post.content) return false

  if (shouldRequireEnglishTranslation()) {
    if (!post.translations?.en?.title || !post.translations?.en?.content) {
      return false
    }
  }

  if (!post.seo?.title || !post.seo?.description) return false

  return true
}

const getTodayPublishedCount = async () => {
  const start = new Date()
  start.setHours(0, 0, 0, 0)

  const end = new Date()
  end.setHours(23, 59, 59, 999)

  return BlogPost.countDocuments({
    isDeleted: false,
    status: 'published',
    publishedAt: {
      $gte: start,
      $lte: end
    }
  })
}

const createAutoPublishLog = async payload => {
  try {
    await BlogAgentLog.create({
      action: 'auto_publish',
      ...payload
    })
  } catch (error) {
    logger.warn('[BlogAutoPublish] Failed to write log:', error.message)
  }
}

const runQueuedBlogPublishJob = async () => {
  if (isPublishing) {
    await createAutoPublishLog({
      status: 'skipped',
      reason: 'job_already_running'
    })
    return { publishedCount: 0, skipped: true }
  }

  isPublishing = true
  const now = new Date()
  const maxPostsPerDay = getMaxPostsPerDay()

  try {
    const todayCount = await getTodayPublishedCount()

    if (todayCount >= maxPostsPerDay) {
      await createAutoPublishLog({
        status: 'skipped',
        reason: 'daily_limit_reached',
        input: { todayCount, max: maxPostsPerDay }
      })

      return { publishedCount: 0, reason: 'daily_limit_reached' }
    }

    const limit = maxPostsPerDay - todayCount
    const candidates = await BlogPost.find({
      isDeleted: false,
      status: 'queued',
      reviewStatus: 'approved',
      'autoPublish.enabled': true,
      $or: [
        { scheduledAt: null },
        { scheduledAt: { $lte: now } }
      ],
      $and: [
        {
          $or: [
            { 'autoPublish.publishAfter': null },
            { 'autoPublish.publishAfter': { $lte: now } }
          ]
        },
        {
          $or: [
            { 'autoPublish.publishBefore': null },
            { 'autoPublish.publishBefore': { $gte: now } }
          ]
        }
      ]
    })
      .sort({
        scheduledAt: 1,
        'autoPublish.priority': -1,
        'autoPublish.approvedAt': 1,
        'ai.qualityScore': -1
      })
      .limit(limit * 3)

    let publishedCount = 0

    for (const post of candidates) {
      if (publishedCount >= limit) break

      if (!hasRequiredContent(post)) {
        await createAutoPublishLog({
          status: 'skipped',
          blogPost: post._id,
          reason: 'missing_required_content_or_translation'
        })
        continue
      }

      if (shouldBlockHighDuplicateRisk() && post.ai?.duplicateRisk === 'high') {
        await createAutoPublishLog({
          status: 'skipped',
          blogPost: post._id,
          reason: 'duplicate_risk_high'
        })
        continue
      }

      post.status = 'published'
      post.publishedAt = now
      post.autoPublish.enabled = false

      await post.save()
      publishedCount += 1

      await createAutoPublishLog({
        status: 'success',
        blogPost: post._id,
        topic: post.ai?.topic || post.title,
        output: {
          slug: post.slug,
          publishedAt: post.publishedAt
        }
      })
    }

    if (publishedCount > 0) {
      await cache.del('blog:list:*', 'blog:detail:*', 'blog:categories', 'blog:tags')
    }

    if (publishedCount === 0) {
      await createAutoPublishLog({
        status: 'skipped',
        reason: 'no_eligible_post'
      })
    }

    return { publishedCount }
  } catch (error) {
    logger.error('[BlogAutoPublish] Job failed:', error)
    await createAutoPublishLog({
      status: 'failed',
      error: error.message
    })
    return { publishedCount: 0, error }
  } finally {
    isPublishing = false
  }
}

module.exports = {
  runQueuedBlogPublishJob
}
