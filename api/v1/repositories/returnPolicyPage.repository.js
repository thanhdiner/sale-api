const ReturnPolicyPage = require('../models/returnPolicyPage.model')

async function findOne(query = {}, options = {}) {
  let cursor = ReturnPolicyPage.findOne(query)

  if (options.lean) {
    cursor = cursor.lean()
  }

  return cursor
}

async function create(payload) {
  return ReturnPolicyPage.create(payload)
}

module.exports = {
  findOne,
  create
}
