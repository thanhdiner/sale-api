const TermsContent = require('../models/termsContent.model')

async function findOne(options = {}) {
  let cursor = TermsContent.findOne({})

  if (options.lean) {
    cursor = cursor.lean()
  }

  return cursor
}

async function create(payload) {
  return TermsContent.create(payload)
}

async function updateById(id, payload) {
  return TermsContent.findByIdAndUpdate(id, payload, {
    new: true,
    runValidators: true
  })
}

module.exports = {
  findOne,
  create,
  updateById
}
