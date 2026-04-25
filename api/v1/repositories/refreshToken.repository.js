const RefreshToken = require('../models/refreshToken.model')

async function findOne(query = {}) {
  return RefreshToken.findOne(query)
}

async function deleteOne(filter = {}) {
  return RefreshToken.deleteOne(filter)
}

module.exports = {
  findOne,
  deleteOne
}
