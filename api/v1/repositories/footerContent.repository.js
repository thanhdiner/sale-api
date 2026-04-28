const FooterContent = require('../models/footerContent.model')

async function findOne(query = {}, options = {}) {
  let cursor = FooterContent.findOne(query)

  if (options.lean) {
    cursor = cursor.lean()
  }

  return cursor
}

async function create(payload) {
  return FooterContent.create(payload)
}

module.exports = {
  findOne,
  create
}
