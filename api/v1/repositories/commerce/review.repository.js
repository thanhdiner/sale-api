const Review = require('../../models/commerce/review.model')

async function find(query = {}, options = {}) {
  const {
    select,
    sort = {},
    skip = 0,
    limit,
    populate,
    lean = false
  } = options

  let cursor = Review.find(query).sort(sort).skip(skip)

  if (select) {
    cursor = cursor.select(select)
  }

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

async function findOne(query = {}, options = {}) {
  const { populate, lean = false } = options
  let cursor = Review.findOne(query)

  if (populate) {
    cursor = cursor.populate(populate)
  }

  if (lean) {
    cursor = cursor.lean()
  }

  return cursor
}

async function countByQuery(query = {}) {
  return Review.countDocuments(query)
}

async function aggregate(pipeline = []) {
  return Review.aggregate(pipeline)
}

async function create(payload) {
  return Review.create(payload)
}

async function findById(id, options = {}) {
  const { populate } = options
  let cursor = Review.findById(id)

  if (populate) {
    cursor = cursor.populate(populate)
  }

  return cursor
}

async function updateById(id, payload, options = {}) {
  return Review.findByIdAndUpdate(id, payload, {
    new: true,
    ...options
  })
}

module.exports = {
  find,
  findOne,
  countByQuery,
  aggregate,
  create,
  findById,
  updateById
}










