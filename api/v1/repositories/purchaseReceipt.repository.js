const PurchaseReceipt = require('../models/purchaseReceipt.model')

async function create(payload) {
  return PurchaseReceipt.create(payload)
}

async function countByQuery(query = {}) {
  return PurchaseReceipt.countDocuments(query)
}

async function findByQuery(query = {}, options = {}) {
  const { sort = { createdAt: -1 }, skip = 0, limit, lean = false, populate } = options
  let cursor = PurchaseReceipt.find(query).sort(sort).skip(skip)

  if (typeof limit === 'number') {
    cursor = cursor.limit(limit)
  }

  if (populate) {
    cursor = cursor.populate(populate)
  }

  if (lean) {
    cursor = cursor.lean()
  }

  return cursor
}

module.exports = {
  create,
  countByQuery,
  findByQuery
}
