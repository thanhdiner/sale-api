const AboutContent = require('../models/aboutContent.model')

async function findOne(options = {}) {
  let cursor = AboutContent.findOne({})

  if (options.lean) {
    cursor = cursor.lean()
  }

  return cursor
}

async function create(payload) {
  return AboutContent.create(payload)
}

async function updateById(id, payload) {
  return AboutContent.findByIdAndUpdate(id, payload, {
    new: true,
    runValidators: true
  })
}

module.exports = {
  findOne,
  create,
  updateById
}
