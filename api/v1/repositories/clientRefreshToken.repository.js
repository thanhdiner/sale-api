const ClientRefreshToken = require('../models/clientRefreshToken.model')

async function findOne(query = {}) {
  return ClientRefreshToken.findOne(query)
}

async function create(payload) {
  return ClientRefreshToken.create(payload)
}

async function deleteOne(filter = {}) {
  return ClientRefreshToken.deleteOne(filter)
}

async function deleteMany(filter = {}) {
  return ClientRefreshToken.deleteMany(filter)
}

module.exports = {
  findOne,
  create,
  deleteOne,
  deleteMany
}
