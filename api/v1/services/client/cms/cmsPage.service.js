const CmsPage = require('../../../models/cms/cmsPage.model')

const DEFAULT_BLOG_DETAIL_TEMPLATE = {
  key: 'blog-detail-template',
  title: 'Blog Detail Template',
  slug: 'blog-detail-template',
  seo: { title: 'Blog Detail', description: '', thumbnail: '' },
  sections: [
    { id: 'post_header_default', type: 'post_header', enabled: true, settings: {} },
    { id: 'post_content_default', type: 'post_content', enabled: true, settings: {} },
    { id: 'toc_default', type: 'table_of_contents', enabled: true, settings: {} },
    { id: 'related_products_default', type: 'related_products', enabled: true, settings: { limit: 3 } },
    { id: 'tags_default', type: 'tags', enabled: true, settings: {} },
    { id: 'related_posts_default', type: 'related_posts', enabled: true, settings: { limit: 3 } },
    { id: 'cta_default', type: 'cta', enabled: true, settings: {} }
  ],
  publishedAt: null,
  updatedAt: null
}

async function show(req, res) {
  try {
    const key = String(req.params.key || '').trim().toLowerCase()
    const page = await CmsPage.findOne({ key, status: 'published' }).select('key title slug seo sections publishedAt updatedAt').lean()

    if (!page && key !== 'blog-detail-template') {
      return res.status(404).json({ message: 'CMS page not found' })
    }

    res.status(200).json({
      message: 'CMS page fetched successfully',
      data: page || DEFAULT_BLOG_DETAIL_TEMPLATE
    })
  } catch {
    res.status(500).json({ error: 'Failed to fetch CMS page' })
  }
}

module.exports = { show }
