const Product = require('../../../models/product/product.model')

const escapeRegex = value => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const buildTopicRegex = topic => {
  const tokens = String(topic || '')
    .split(/\s+/)
    .map(token => token.trim())
    .filter(token => token.length >= 2)
    .slice(0, 8)
    .map(escapeRegex)

  return tokens.length > 0 ? new RegExp(tokens.join('|'), 'i') : null
}

const normalizeLimit = value => Math.min(Math.max(parseInt(value, 10) || 6, 1), 12)

const suggestRelatedProducts = async ({ topic, limit = 6 }) => {
  const regex = buildTopicRegex(topic)
  if (!regex) return []

  return Product.find({
    deleted: { $ne: true },
    status: 'active',
    $or: [
      { title: regex },
      { titleNoAccent: regex },
      { description: regex },
      { content: regex },
      { features: regex }
    ]
  })
    .select('title slug thumbnail price discountPercentage soldQuantity recommendScore')
    .sort({
      recommendScore: -1,
      soldQuantity: -1,
      viewsCount: -1
    })
    .limit(normalizeLimit(limit))
    .lean()
}

module.exports = {
  suggestRelatedProducts
}









