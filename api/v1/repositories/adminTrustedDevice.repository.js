const AdminTrustedDevice = require('../models/adminTrustedDevice.model')

async function findOne(query = {}) {
  return AdminTrustedDevice.findOne(query)
}

async function findByQuery(query = {}, options = {}) {
  let cursor = AdminTrustedDevice.find(query)

  if (options.sort) {
    cursor = cursor.sort(options.sort)
  }

  if (options.lean) {
    cursor = cursor.lean()
  }

  return cursor
}

async function create(payload) {
  return AdminTrustedDevice.create(payload)
}

async function findOneAndDelete(query = {}) {
  return AdminTrustedDevice.findOneAndDelete(query)
}

module.exports = {
  findOne,
  findByQuery,
  create,
  findOneAndDelete
}
