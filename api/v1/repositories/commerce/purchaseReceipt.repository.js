const PurchaseReceipt = require('../../models/commerce/purchaseReceipt.model')

async function create(payload, options = {}) {
  const receipt = new PurchaseReceipt(payload)
  return receipt.save({ session: options.session })
}

async function findById(id, options = {}) {
  const { session, lean = false, populate } = options
  let cursor = PurchaseReceipt.findById(id)

  if (session) cursor = cursor.session(session)
  if (populate) cursor = cursor.populate(populate)
  if (lean) cursor = cursor.lean()

  return cursor
}

async function findOneAndUpdate(filter, update, options = {}) {
  const { session, lean = false, populate, new: returnNew = true } = options
  let cursor = PurchaseReceipt.findOneAndUpdate(filter, update, { session, new: returnNew })

  if (populate) cursor = cursor.populate(populate)
  if (lean) cursor = cursor.lean()

  return cursor
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
  findById,
  findOneAndUpdate,
  countByQuery,
  findByQuery
}










