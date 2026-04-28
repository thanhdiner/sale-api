const FlashSale = require('../models/flashSale.model')

async function countByQuery(query = {}) {
  return FlashSale.countDocuments(query)
}

async function findByQuery(query = {}, options = {}) {
  const {
    populate,
    sort = { startAt: -1 },
    skip = 0,
    limit,
    lean = false
  } = options

  let cursor = FlashSale.find(query).sort(sort).skip(skip)

  if (populate) {
    cursor = cursor.populate(populate)
  }

  if (typeof limit === 'number') {
    cursor = cursor.limit(limit)
  }

  if (lean) {
    cursor = cursor.lean()
  }

  return cursor
}

async function findAll(query = {}, options = {}) {
  return findByQuery(query, options)
}

async function findById(id, options = {}) {
  const { populate, select, lean = false } = options
  let cursor = FlashSale.findById(id)

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

async function create(payload) {
  return FlashSale.create(payload)
}

async function updateById(id, payload, options = {}) {
  return FlashSale.findByIdAndUpdate(id, payload, {
    new: true,
    runValidators: true,
    ...options
  })
}

async function deleteById(id) {
  return FlashSale.findByIdAndDelete(id)
}

async function deleteMany(query = {}) {
  return FlashSale.deleteMany(query)
}

async function updateMany(filter = {}, update = {}) {
  return FlashSale.updateMany(filter, update)
}

async function updateOne(filter, update) {
  return FlashSale.updateOne(filter, update)
}

module.exports = {
  countByQuery,
  findByQuery,
  findAll,
  findById,
  create,
  updateById,
  deleteById,
  deleteMany,
  updateMany,
  updateOne
}
