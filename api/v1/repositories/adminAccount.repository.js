const AdminAccount = require('../models/adminAccount.model')

async function findById(id, options = {}) {
  let cursor = AdminAccount.findById(id)

  if (options.select) {
    cursor = cursor.select(options.select)
  }

  if (options.populate) {
    const populateOptions = Array.isArray(options.populate) ? options.populate : [options.populate]
    populateOptions.forEach(populateOption => {
      cursor = cursor.populate(populateOption)
    })
  }

  if (options.lean) {
    cursor = cursor.lean()
  }

  return cursor
}

async function findOne(query = {}, options = {}) {
  let cursor = AdminAccount.findOne(query)

  if (options.select) {
    cursor = cursor.select(options.select)
  }

  if (options.populate) {
    const populateOptions = Array.isArray(options.populate) ? options.populate : [options.populate]
    populateOptions.forEach(populateOption => {
      cursor = cursor.populate(populateOption)
    })
  }

  if (options.lean) {
    cursor = cursor.lean()
  }

  return cursor
}

async function findByQuery(query = {}, options = {}) {
  let cursor = AdminAccount.find(query)

  if (options.select) {
    cursor = cursor.select(options.select)
  }

  if (options.sort) {
    cursor = cursor.sort(options.sort)
  }

  if (options.populate) {
    const populateOptions = Array.isArray(options.populate) ? options.populate : [options.populate]
    populateOptions.forEach(populateOption => {
      cursor = cursor.populate(populateOption)
    })
  }

  if (options.lean) {
    cursor = cursor.lean()
  }

  return cursor
}

async function countByQuery(query = {}) {
  return AdminAccount.countDocuments(query)
}

async function create(payload) {
  return AdminAccount.create(payload)
}

async function updateById(id, payload, options = {}) {
  return AdminAccount.findByIdAndUpdate(id, payload, {
    new: true,
    ...options
  })
}

module.exports = {
  findById,
  findOne,
  findByQuery,
  countByQuery,
  create,
  updateById
}
