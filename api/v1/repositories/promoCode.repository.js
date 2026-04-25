const PromoCode = require('../models/promoCode.model')

async function findAll(filter = {}, options = {}) {
  const {
    sort = { createdAt: -1 },
    skip = 0,
    limit,
    lean = false
  } = options

  let cursor = PromoCode.find(filter).sort(sort).skip(skip)

  if (typeof limit === 'number') {
    cursor = cursor.limit(limit)
  }

  if (lean) {
    cursor = cursor.lean()
  }

  return cursor
}

async function countByQuery(query = {}) {
  return PromoCode.countDocuments(query)
}

async function findById(id) {
  return PromoCode.findById(id)
}

async function findOne(filter = {}, options = {}) {
  let cursor = PromoCode.findOne(filter)

  if (options.lean) {
    cursor = cursor.lean()
  }

  return cursor
}

async function create(payload) {
  return PromoCode.create(payload)
}

async function updateById(id, payload, options = {}) {
  return PromoCode.findByIdAndUpdate(id, payload, {
    new: true,
    ...options
  })
}

async function updateOne(filter, update) {
  return PromoCode.updateOne(filter, update)
}

async function deleteById(id) {
  return PromoCode.findByIdAndDelete(id)
}

module.exports = {
  findAll,
  countByQuery,
  findById,
  findOne,
  create,
  updateById,
  updateOne,
  deleteById
}
