const EmailUpdateCode = require('../../models/access/emailUpdateCode.model')

async function findOne(query = {}) {
  return EmailUpdateCode.findOne(query)
}

async function create(payload) {
  return EmailUpdateCode.create(payload)
}

async function deleteMany(filter = {}) {
  return EmailUpdateCode.deleteMany(filter)
}

module.exports = {
  findOne,
  create,
  deleteMany
}










