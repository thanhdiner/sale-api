const ProductView = require('../models/productView.model')

async function create(payload) {
  return ProductView.create(payload)
}

async function findRecentViewedProducts(viewerKeys = [], limit = 5) {
  const keys = [...new Set(viewerKeys.filter(Boolean))]
  if (keys.length === 0) return []

  return ProductView.aggregate([
    { $match: { viewerKey: { $in: keys } } },
    { $sort: { viewedAt: -1 } },
    {
      $group: {
        _id: '$productId',
        viewedAt: { $first: '$viewedAt' }
      }
    },
    { $sort: { viewedAt: -1 } },
    { $limit: limit },
    {
      $lookup: {
        from: 'products',
        localField: '_id',
        foreignField: '_id',
        as: 'product'
      }
    },
    { $unwind: '$product' },
    {
      $match: {
        'product.deleted': false,
        'product.status': 'active'
      }
    },
    {
      $project: {
        viewedAt: 1,
        product: {
          _id: '$product._id',
          title: '$product.title',
          slug: '$product.slug',
          thumbnail: '$product.thumbnail',
          price: '$product.price',
          discountPercentage: '$product.discountPercentage',
          stock: '$product.stock',
          soldQuantity: '$product.soldQuantity',
          rate: '$product.rate',
          deliveryEstimateDays: '$product.deliveryEstimateDays',
          viewsCount: '$product.viewsCount',
          recommendScore: '$product.recommendScore'
        }
      }
    }
  ])
}

module.exports = {
  create,
  findRecentViewedProducts
}
