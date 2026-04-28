const Order = require('../models/order.model')

async function findById(id) {
  return Order.findById(id)
}

async function create(payload) {
  return Order.create(payload)
}

async function deleteOne(filter) {
  return Order.deleteOne(filter)
}

async function findByIdNotDeleted(id, options = {}) {
  const { select, populate, lean = false } = options
  let cursor = Order.findOne({ _id: id, isDeleted: false })

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

async function findOne(query = {}, options = {}) {
  const { lean = false, sort = null, select, populate } = options
  let cursor = Order.findOne(query)

  if (sort) {
    cursor = cursor.sort(sort)
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

async function countByQuery(query = {}) {
  return Order.countDocuments(query)
}

async function aggregate(pipeline = []) {
  return Order.aggregate(pipeline)
}

async function findByQuery(query, options = {}) {
  const {
    select,
    sort = { createdAt: -1 },
    skip = 0,
    limit,
    lean = false,
    populate
  } = options

  let cursor = Order.find(query).sort(sort).skip(skip)

  if (select) {
    cursor = cursor.select(select)
  }

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

module.exports = {
  findById,
  create,
  deleteOne,
  findByIdNotDeleted,
  findOne,
  countByQuery,
  aggregate,
  findByQuery
}
