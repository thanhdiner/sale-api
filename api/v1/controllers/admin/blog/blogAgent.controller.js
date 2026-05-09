const logger = require('../../../../../config/logger')
const BlogAgentLog = require('../../../models/blog/blogAgentLog.model')
const { runBlogAutoDraftJob } = require('../../../jobs/blogAutoDraft.job')

const normalizeText = value => (typeof value === 'string' ? value.trim() : '')

const buildLogQuery = (params = {}) => {
  const query = {}
  const batchId = normalizeText(params.batchId)
  const action = normalizeText(params.action)
  const status = normalizeText(params.status)
  const keyword = normalizeText(params.keyword || params.search)

  if (batchId) query.batchId = batchId
  if (action) query.action = action
  if (status) query.status = status
  if (keyword) {
    const regex = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    query.$or = [
      { batchId: regex },
      { action: regex },
      { topic: regex },
      { reason: regex },
      { error: regex }
    ]
  }

  return query
}

module.exports.generateDrafts = async (req, res) => {
  try {
    const result = await runBlogAutoDraftJob({
      batchId: normalizeText(req.body.batchId) || undefined,
      postsPerRun: parseInt(req.body.postsPerRun, 10) || undefined,
      language: normalizeText(req.body.language) || 'vi',
      generateEnglish: req.body.generateEnglish !== false && req.body.generateEnglish !== 'false',
      provider: normalizeText(req.body.provider) || undefined,
      model: normalizeText(req.body.model) || undefined
    })

    res.status(201).json({
      message: 'Blog drafts generated successfully',
      data: result
    })
  } catch (error) {
    logger.error('[Admin] Error generating blog drafts:', error)
    res.status(500).json({ error: 'Failed to generate blog drafts', message: error.message })
  }
}

module.exports.logs = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1)
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100)
    const query = buildLogQuery(req.query)

    const [total, logs] = await Promise.all([
      BlogAgentLog.countDocuments(query),
      BlogAgentLog.find(query)
        .populate('blogPost', 'title slug status reviewStatus')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
    ])

    res.status(200).json({
      message: 'Blog agent logs fetched successfully',
      data: logs,
      total,
      page,
      limit
    })
  } catch (error) {
    logger.error('[Admin] Error fetching blog agent logs:', error)
    res.status(500).json({ error: 'Failed to fetch blog agent logs' })
  }
}

module.exports.batches = async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 100)
    const data = await BlogAgentLog.aggregate([
      { $match: { batchId: { $nin: [null, ''] } } },
      {
        $group: {
          _id: '$batchId',
          batchId: { $first: '$batchId' },
          createdAt: { $min: '$createdAt' },
          updatedAt: { $max: '$createdAt' },
          actions: { $addToSet: '$action' },
          successCount: {
            $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] }
          },
          failedCount: {
            $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
          },
          skippedCount: {
            $sum: { $cond: [{ $eq: ['$status', 'skipped'] }, 1, 0] }
          },
          draftIds: {
            $addToSet: '$blogPost'
          }
        }
      },
      { $sort: { updatedAt: -1 } },
      { $limit: limit }
    ])

    res.status(200).json({
      message: 'Blog agent batches fetched successfully',
      data: data.map(item => ({
        ...item,
        draftIds: (item.draftIds || []).filter(Boolean)
      }))
    })
  } catch (error) {
    logger.error('[Admin] Error fetching blog agent batches:', error)
    res.status(500).json({ error: 'Failed to fetch blog agent batches' })
  }
}










