const PrivacyPolicyPage = require('../models/privacyPolicyPage.model')

async function findOne(query = {}, options = {}) {
  let cursor = PrivacyPolicyPage.findOne(query)

  if (options.lean) {
    cursor = cursor.lean()
  }

  return cursor
}

async function create(payload = {}) {
  return PrivacyPolicyPage.create(payload)
}

module.exports = {
  create,
  findOne
}
