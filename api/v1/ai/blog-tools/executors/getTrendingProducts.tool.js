const Product = require('../../../models/product/product.model')

const normalizeLimit = value => Math.min(Math.max(parseInt(value, 10) || 10, 1), 20)

const getTrendingProducts = async ({ limit = 10 } = {}) => {
  return Product.find({
    deleted: { $ne: true },
    status: 'active'
  })
    .select('title slug price discountPercentage soldQuantity viewsCount recommendScore productCategory thumbnail')
    .populate('productCategory', 'title slug translations')
    .sort({
      isTopDeal: -1,
      isFeatured: -1,
      recommendScore: -1,
      soldQuantity: -1,
      viewsCount: -1
    })
    .limit(normalizeLimit(limit))
    .lean()
}

module.exports = {
  getTrendingProducts
}









