const PermissionGroup = require('../models/permission-group.model')

async function findOne(query = {}, options = {}) {
  let cursor = PermissionGroup.findOne(query)

  if (options.lean) {
    cursor = cursor.lean()
  }

  return cursor
}

async function findById(id, options = {}) {
  let cursor = PermissionGroup.findById(id)

  if (options.lean) {
    cursor = cursor.lean()
  }

  return cursor
}

async function findByQuery(query = {}, options = {}) {
  let cursor = PermissionGroup.find(query)

  if (options.sort) {
    cursor = cursor.sort(options.sort)
  }

  if (options.lean) {
    cursor = cursor.lean()
  }

  return cursor
}

async function create(payload) {
  return PermissionGroup.create(payload)
}

async function updateById(id, payload, options = {}) {
  return PermissionGroup.findByIdAndUpdate(id, payload, {
    new: true,
    ...options
  })
}

module.exports = {
  findOne,
  findById,
  findByQuery,
  create,
  updateById
}
