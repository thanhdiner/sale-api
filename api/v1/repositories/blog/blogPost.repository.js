const BlogPost = require('../../models/blog/blogPost.model')

async function countByQuery(query = {}) {
  return BlogPost.countDocuments(query)
}

async function findByQuery(query = {}, options = {}) {
  const {
    select,
    sort = { publishedAt: -1, updatedAt: -1 },
    skip = 0,
    limit,
    lean = false,
    populate
  } = options

  let cursor = BlogPost.find(query).sort(sort).skip(skip)

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
  const { select, sort = {}, lean = false, populate } = options
  let cursor = BlogPost.findOne(query).sort(sort)

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

async function findById(id, options = {}) {
  const { select, lean = false, populate } = options
  let cursor = BlogPost.findById(id)

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

async function find(query = {}) {
  return BlogPost.find(query)
}

async function create(payload) {
  return BlogPost.create(payload)
}

async function updateById(id, payload, options = {}) {
  return BlogPost.findByIdAndUpdate(id, payload, {
    new: true,
    runValidators: true,
    ...options
  })
}

module.exports = {
  countByQuery,
  findByQuery,
  findOne,
  findById,
  find,
  create,
  updateById
}










