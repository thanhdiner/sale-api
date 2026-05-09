const Product = require('../../models/product/product.model')

const EXPLORE_MORE_SELECT = 'title slug thumbnail price discountPercentage stock soldQuantity rate isTopDeal isFeatured deliveryEstimateDays viewsCount recommendScore createdAt'
const EXPLORE_MORE_SORT = {
  isTopDeal: -1,
  isFeatured: -1,
  recommendScore: -1,
  soldQuantity: -1,
  viewsCount: -1,
  rate: -1,
  createdAt: -1
}

async function findByIdNotDeleted(productId) {
  return Product.findOne({
    _id: productId,
    deleted: { $ne: true }
  })
}

async function findByIdsNotDeleted(productIds) {
  return Product.find({
    _id: { $in: productIds },
    deleted: { $ne: true }
  }).lean()
}

async function countByQuery(query = {}) {
  return Product.countDocuments(query)
}

async function aggregate(pipeline = []) {
  return Product.aggregate(pipeline)
}

async function findOne(query = {}, options = {}) {
  const { select, lean = false, populate } = options

  let cursor = Product.findOne(query)

  if (select) {
    cursor = cursor.select(select)
  }

  if (populate) {
    cursor = cursor.populate(populate)
  }

  if (lean) {
    cursor = cursor.lean()
  }

  return cursor
}

async function findByQuery(query, options = {}) {
  const {
    sort = { createdAt: -1 },
    skip = 0,
    limit,
    select,
    lean = false,
    populate
  } = options

  let cursor = Product.find(query).sort(sort).skip(skip)

  if (typeof limit === 'number') {
    cursor = cursor.limit(limit)
  }

  if (select) {
    cursor = cursor.select(select)
  }

  if (populate) {
    cursor = cursor.populate(populate)
  }

  if (lean) {
    cursor = cursor.lean()
  }

  return cursor
}

async function findOneActiveBySlug(slug, options = {}) {
  const { populate, select, lean = false } = options
  let cursor = Product.findOne({
    deleted: false,
    status: 'active',
    slug
  })

  if (populate) {
    cursor = cursor.populate(populate)
  }

  if (select) {
    cursor = cursor.select(select)
  }

  if (lean) {
    cursor = cursor.lean()
  }

  return cursor
}

async function findActiveProductIdentity(productId) {
  return Product.findOne({
    _id: productId,
    status: 'active',
    deleted: false
  }).select('_id productCategory')
}

async function findExploreMoreByCategory({ currentProductId, categoryId, limit }) {
  return Product.find({
    _id: { $ne: currentProductId },
    productCategory: categoryId,
    status: 'active',
    deleted: false
  })
    .sort(EXPLORE_MORE_SORT)
    .limit(limit)
    .select(EXPLORE_MORE_SELECT)
    .lean()
}

async function findExploreMoreFallback({ currentProductId, excludeIds = [], limit }) {
  return Product.find({
    _id: {
      $ne: currentProductId,
      $nin: excludeIds
    },
    status: 'active',
    deleted: false
  })
    .sort(EXPLORE_MORE_SORT)
    .limit(limit)
    .select(EXPLORE_MORE_SELECT)
    .lean()
}

async function findDistinctCategoriesByIds(productIds) {
  return Product.distinct('productCategory', { _id: { $in: productIds } })
}

async function findById(productId, options = {}) {
  const { select, lean = false, populate } = options
  let cursor = Product.findById(productId)

  if (select) {
    cursor = cursor.select(select)
  }

  if (populate) {
    cursor = cursor.populate(populate)
  }

  if (lean) {
    cursor = cursor.lean()
  }

  return cursor
}

async function bulkWrite(operations) {
  return Product.bulkWrite(operations)
}

async function updateOne(filter, update, options = {}) {
  return Product.updateOne(filter, update, options)
}

async function incrementViewsCount(productId) {
  return Product.updateOne({ _id: productId }, { $inc: { viewsCount: 1 } })
}

module.exports = {
  findByIdNotDeleted,
  findByIdsNotDeleted,
  countByQuery,
  aggregate,
  findOne,
  findByQuery,
  findOneActiveBySlug,
  findActiveProductIdentity,
  findExploreMoreByCategory,
  findExploreMoreFallback,
  findDistinctCategoriesByIds,
  findById,
  bulkWrite,
  updateOne,
  incrementViewsCount
}










