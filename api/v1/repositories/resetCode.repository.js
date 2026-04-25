const ResetCode = require('../models/resetCode.model')

async function findOne(query = {}) {
  return ResetCode.findOne(query)
}

async function create(payload) {
  return ResetCode.create(payload)
}

async function deleteMany(filter = {}) {
  return ResetCode.deleteMany(filter)
}

module.exports = {
  findOne,
  create,
  deleteMany
}
