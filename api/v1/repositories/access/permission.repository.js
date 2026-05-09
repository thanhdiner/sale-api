const Permission = require('../../models/access/permission.model')

async function findOne(query = {}, options = {}) {
  let cursor = Permission.findOne(query)

  if (options.lean) {
    cursor = cursor.lean()
  }

  return cursor
}

async function findById(id, options = {}) {
  let cursor = Permission.findById(id)

  if (options.lean) {
    cursor = cursor.lean()
  }

  return cursor
}

async function findByQuery(query = {}, options = {}) {
  let cursor = Permission.find(query)

  if (options.sort) {
    cursor = cursor.sort(options.sort)
  }

  if (options.lean) {
    cursor = cursor.lean()
  }

  return cursor
}

async function countByQuery(query = {}) {
  return Permission.countDocuments(query)
}

async function create(payload) {
  return Permission.create(payload)
}

async function updateById(id, payload, options = {}) {
  return Permission.findByIdAndUpdate(id, payload, {
    new: true,
    ...options
  })
}

module.exports = {
  findOne,
  findById,
  findByQuery,
  countByQuery,
  create,
  updateById
}










