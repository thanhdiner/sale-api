const OauthCode = require('../../models/access/oauthCode.model')

async function findOne(query = {}) {
  return OauthCode.findOne(query)
}

async function create(payload) {
  return OauthCode.create(payload)
}

module.exports = {
  findOne,
  create
}










