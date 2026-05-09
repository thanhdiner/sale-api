const AppError = require('../../../utils/AppError')
const BlogPost = require('../../../models/blog/blogPost.model')
const CmsPage = require('../../../models/cms/cmsPage.model')
const CmsRevision = require('../../../models/cms/cmsRevision.model')

function getAdminId(user = null) {
  return user?.userId || user?.id || user?._id || null
}

async function createRevision({ entityType, entityId = null, key = '', snapshot, message = '', user = null }) {
  if (!snapshot) return null
  return CmsRevision.create({ entityType, entityId, key, snapshot, message, createdBy: getAdminId(user) })
}

async function listRevisions(params = {}) {
  const query = {}
  if (params.entityType) query.entityType = params.entityType
  if (params.entityId) query.entityId = params.entityId
  if (params.key) query.key = params.key

  const data = await CmsRevision.find(query).sort({ createdAt: -1 }).limit(50).lean()
  return { message: 'CMS revisions fetched successfully', data }
}

async function restoreRevision(id, user = null) {
  const revision = await CmsRevision.findById(id).lean()
  if (!revision) throw new AppError('Revision not found', 404)

  if (revision.entityType === 'blog_post') {
    const post = await BlogPost.findById(revision.entityId)
    if (!post) throw new AppError('Blog post not found', 404)
    await createRevision({ entityType: 'blog_post', entityId: post._id, snapshot: post.toObject(), message: 'Before restore', user })
    Object.assign(post, revision.snapshot)
    post.updatedBy = getAdminId(user)
    post.updatedAt = new Date()
    await post.save()
    return { message: 'Blog post revision restored successfully', data: post }
  }

  if (revision.entityType === 'cms_page') {
    const page = await CmsPage.findOne(revision.entityId ? { _id: revision.entityId } : { key: revision.key })
    if (!page) throw new AppError('CMS page not found', 404)
    await createRevision({ entityType: 'cms_page', entityId: page._id, key: page.key, snapshot: page.toObject(), message: 'Before restore', user })
    Object.assign(page, revision.snapshot)
    page.updatedBy = getAdminId(user)
    await page.save()
    return { message: 'CMS page revision restored successfully', data: page }
  }

  throw new AppError('Revision entity type is invalid', 400)
}

module.exports = { createRevision, listRevisions, restoreRevision }












