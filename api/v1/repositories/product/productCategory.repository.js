const ProductCategory = require('../../models/product/productCategory.model')

async function countByQuery(query = {}) {
  return ProductCategory.countDocuments(query)
}

async function findAll(query = {}, options = {}) {
  const {
    select,
    sort = { position: -1 },
    skip = 0,
    limit,
    populate,
    lean = false
  } = options

  let cursor = ProductCategory.find(query).sort(sort).skip(skip)

  if (select) {
    cursor = cursor.select(select)
  }

  if (typeof limit === 'number') {
    cursor = cursor.limit(limit)
  }

  if (populate) {
    const populates = Array.isArray(populate) ? populate : [populate]
    for (const item of populates) {
      cursor = cursor.populate(item)
    }
  }

  if (lean) {
    cursor = cursor.lean()
  }

  return cursor
}

async function findOne(query = {}, options = {}) {
  const { select, sort = {}, populate, lean = false } = options
  let cursor = ProductCategory.findOne(query).sort(sort)

  if (select) {
    cursor = cursor.select(select)
  }

  if (populate) {
    const populates = Array.isArray(populate) ? populate : [populate]
    for (const item of populates) {
      cursor = cursor.populate(item)
    }
  }

  if (lean) {
    cursor = cursor.lean()
  }

  return cursor
}

async function findById(id, options = {}) {
  const { select, populate, lean = false } = options
  let cursor = ProductCategory.findById(id)

  if (select) {
    cursor = cursor.select(select)
  }

  if (populate) {
    const populates = Array.isArray(populate) ? populate : [populate]
    for (const item of populates) {
      cursor = cursor.populate(item)
    }
  }

  if (lean) {
    cursor = cursor.lean()
  }

  return cursor
}

async function find(query = {}) {
  return ProductCategory.find(query)
}

async function create(payload) {
  return ProductCategory.create(payload)
}

async function updateById(id, payload, options = {}) {
  return ProductCategory.findByIdAndUpdate(id, payload, {
    new: true,
    runValidators: true,
    ...options
  })
}

async function updateOne(filter, update) {
  return ProductCategory.updateOne(filter, update)
}

async function updateMany(filter, update) {
  return ProductCategory.updateMany(filter, update)
}

async function bulkWrite(operations) {
  return ProductCategory.bulkWrite(operations)
}

async function aggregate(pipeline = []) {
  return ProductCategory.aggregate(pipeline)
}

module.exports = {
  countByQuery,
  findAll,
  findOne,
  findById,
  find,
  aggregate,
  create,
  updateById,
  updateOne,
  updateMany,
  bulkWrite
}










