const AppError = require('../../../utils/AppError')
const CmsPage = require('../../../models/cms/cmsPage.model')
const { createRevision } = require('../cms/cmsRevision.service')

const PAGE_SECTION_TYPES = {
  blog: new Set(['hero', 'featured_posts', 'latest_articles', 'category_tabs', 'popular_posts', 'tag_cloud', 'cta']),
  'blog-detail-template': new Set(['post_header', 'post_content', 'table_of_contents', 'author_box', 'related_products', 'related_posts', 'tags', 'cta', 'comments'])
}
const ALLOWED_PAGE_KEYS = new Set(Object.keys(PAGE_SECTION_TYPES))
const MAX_SECTIONS = 20
const MAX_SETTINGS_BYTES = 12000

function getAdminId(user = null) {
  return user?.userId || user?.id || user?._id || null
}

function normalizeText(value, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback
}

function parseJson(value, fallback) {
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

function normalizeKey(key) {
  const normalizedKey = normalizeText(key).toLowerCase()
  if (!ALLOWED_PAGE_KEYS.has(normalizedKey)) {
    throw new AppError('CMS page key is invalid', 400)
  }
  return normalizedKey
}

function normalizeSeo(value = {}) {
  const seo = parseJson(value, {}) || {}
  return {
    title: normalizeText(seo.title).slice(0, 180),
    description: normalizeText(seo.description).slice(0, 300),
    thumbnail: normalizeText(seo.thumbnail).slice(0, 500)
  }
}

function normalizeSections(value = [], key = 'blog') {
  const parsedSections = parseJson(value, [])
  const allowedTypes = PAGE_SECTION_TYPES[key] || PAGE_SECTION_TYPES.blog
  if (!Array.isArray(parsedSections)) {
    throw new AppError('Sections must be an array', 400)
  }
  if (parsedSections.length > MAX_SECTIONS) {
    throw new AppError(`Sections cannot exceed ${MAX_SECTIONS}`, 400)
  }

  return parsedSections.map((section, index) => {
    const type = normalizeText(section?.type)
    if (!allowedTypes.has(type)) {
      throw new AppError(`Section type is invalid at index ${index}`, 400)
    }

    const settings = section?.settings && typeof section.settings === 'object' && !Array.isArray(section.settings)
      ? section.settings
      : {}

    if (Buffer.byteLength(JSON.stringify(settings), 'utf8') > MAX_SETTINGS_BYTES) {
      throw new AppError(`Section settings are too large at index ${index}`, 400)
    }

    return {
      id: normalizeText(section?.id) || `${type}_${Date.now()}_${index}`,
      type,
      enabled: section?.enabled !== false,
      settings
    }
  })
}

function defaultCmsPage(key) {
  if (key === 'blog-detail-template') {
    return {
      key,
      title: 'Blog Detail Template',
      slug: 'blog-detail-template',
      status: 'draft',
      seo: { title: 'Blog Detail', description: '', thumbnail: '' },
      sections: [],
      draftSections: [
        { id: 'post_header_default', type: 'post_header', enabled: true, settings: {} },
        { id: 'post_content_default', type: 'post_content', enabled: true, settings: {} },
        { id: 'toc_default', type: 'table_of_contents', enabled: true, settings: {} },
        { id: 'related_products_default', type: 'related_products', enabled: true, settings: { limit: 3 } },
        { id: 'tags_default', type: 'tags', enabled: true, settings: {} },
        { id: 'related_posts_default', type: 'related_posts', enabled: true, settings: { limit: 3 } },
        { id: 'cta_default', type: 'cta', enabled: true, settings: {} },
        { id: 'author_box_default', type: 'author_box', enabled: false, settings: {} },
        { id: 'comments_default', type: 'comments', enabled: false, settings: {} }
      ]
    }
  }

  return {
    key: 'blog',
    title: 'Blog',
    slug: 'blog',
    status: 'draft',
    seo: {
      title: 'SmartMall Blog',
      description: 'Latest news and shopping guides',
      thumbnail: ''
    },
    sections: [],
    draftSections: [
      { id: 'hero_default', type: 'hero', enabled: true, settings: {} },
      { id: 'featured_default', type: 'featured_posts', enabled: true, settings: {} },
      { id: 'latest_default', type: 'latest_articles', enabled: true, settings: {} },
      { id: 'popular_default', type: 'popular_posts', enabled: true, settings: {} },
      { id: 'tag_default', type: 'tag_cloud', enabled: true, settings: {} },
      { id: 'cta_default', type: 'cta', enabled: true, settings: {} }
    ]
  }
}

async function findOrCreatePage(key) {
  const normalizedKey = normalizeKey(key)
  let page = await CmsPage.findOne({ key: normalizedKey })
  if (page) return page

  return CmsPage.create(defaultCmsPage(normalizedKey))
}

async function getCmsPage(key) {
  const page = await findOrCreatePage(key)
  return {
    message: 'CMS page fetched successfully',
    data: page
  }
}

async function saveDraft(key, payload = {}, user = null) {
  const page = await findOrCreatePage(key)

  if (Object.prototype.hasOwnProperty.call(payload, 'title')) page.title = normalizeText(payload.title).slice(0, 180)
  if (Object.prototype.hasOwnProperty.call(payload, 'slug')) page.slug = normalizeText(payload.slug).toLowerCase().slice(0, 220)
  if (Object.prototype.hasOwnProperty.call(payload, 'seo')) page.seo = normalizeSeo(payload.seo)
  if (Object.prototype.hasOwnProperty.call(payload, 'sections')) page.draftSections = normalizeSections(payload.sections, page.key)

  await createRevision({ entityType: 'cms_page', entityId: page._id, key: page.key, snapshot: page.toObject(), message: 'Before draft save', user })
  page.status = page.sections.length ? page.status : 'draft'
  page.updatedBy = getAdminId(user)
  await page.save()

  return {
    message: 'CMS page draft saved successfully',
    data: page
  }
}

async function schedulePage(key, payload = {}, user = null) {
  const page = await findOrCreatePage(key)
  const scheduledAt = new Date(payload.scheduledAt)
  if (Number.isNaN(scheduledAt.getTime())) throw new AppError('Scheduled date is invalid', 400)

  if (Object.prototype.hasOwnProperty.call(payload, 'sections')) page.draftSections = normalizeSections(payload.sections, page.key)
  await createRevision({ entityType: 'cms_page', entityId: page._id, key: page.key, snapshot: page.toObject(), message: 'Before schedule', user })
  page.scheduledAt = scheduledAt
  page.scheduleStatus = 'scheduled'
  page.updatedBy = getAdminId(user)
  await page.save()

  return { message: 'CMS page scheduled successfully', data: page }
}

async function publishDuePages() {
  const duePages = await CmsPage.find({ scheduleStatus: 'scheduled', scheduledAt: { $lte: new Date() } })
  for (const page of duePages) {
    page.sections = normalizeSections(page.draftSections, page.key)
    page.status = 'published'
    page.scheduleStatus = 'none'
    page.scheduledAt = null
    page.publishedAt = new Date()
    await page.save()
  }
  return { message: 'Due CMS pages published successfully', data: duePages.length }
}

async function publishPage(key, payload = {}, user = null) {
  const page = await findOrCreatePage(key)
  const sections = Object.prototype.hasOwnProperty.call(payload, 'sections')
    ? normalizeSections(payload.sections, page.key)
    : normalizeSections(page.draftSections, page.key)

  await createRevision({ entityType: 'cms_page', entityId: page._id, key: page.key, snapshot: page.toObject(), message: 'Before publish', user })
  page.sections = sections
  page.draftSections = sections
  page.status = 'published'
  page.scheduleStatus = 'none'
  page.scheduledAt = null
  page.publishedAt = new Date()
  page.updatedBy = getAdminId(user)

  if (Object.prototype.hasOwnProperty.call(payload, 'title')) page.title = normalizeText(payload.title).slice(0, 180)
  if (Object.prototype.hasOwnProperty.call(payload, 'slug')) page.slug = normalizeText(payload.slug).toLowerCase().slice(0, 220)
  if (Object.prototype.hasOwnProperty.call(payload, 'seo')) page.seo = normalizeSeo(payload.seo)

  await page.save()

  return {
    message: 'CMS page published successfully',
    data: page
  }
}

module.exports = {
  getCmsPage,
  saveDraft,
  schedulePage,
  publishDuePages,
  publishPage
}












