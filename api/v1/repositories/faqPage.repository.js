const FaqPage = require('../models/faqPage.model')

async function findOne(query = {}, options = {}) {
  let cursor = FaqPage.findOne(query)

  if (options.lean) {
    cursor = cursor.lean()
  }

  return cursor
}

async function create(payload) {
  return FaqPage.create(payload)
}

module.exports = {
  findOne,
  create
}
