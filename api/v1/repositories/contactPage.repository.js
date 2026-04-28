const ContactPage = require('../models/contactPage.model')

async function findOne(query = {}, options = {}) {
  let cursor = ContactPage.findOne(query)

  if (options.lean) {
    cursor = cursor.lean()
  }

  return cursor
}

async function create(payload) {
  return ContactPage.create(payload)
}

module.exports = {
  findOne,
  create
}
