const CmsPage = require('../../models/cmsPage.model')

async function show(req, res) {
  try {
    const key = String(req.params.key || '').trim().toLowerCase()
    const page = await CmsPage.findOne({ key, status: 'published' }).select('key title slug seo sections publishedAt updatedAt').lean()

    if (!page) {
      return res.status(404).json({ message: 'CMS page not found' })
    }

    res.status(200).json({
      message: 'CMS page fetched successfully',
      data: page
    })
  } catch {
    res.status(500).json({ error: 'Failed to fetch CMS page' })
  }
}

module.exports = { show }
