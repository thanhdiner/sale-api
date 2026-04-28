const ComingSoonContent = require('../models/comingSoonContent.model')

async function findByKey(key, options = {}) {
  let cursor = ComingSoonContent.findOne({ key })

  if (options.lean) {
    cursor = cursor.lean()
  }

  return cursor
}

async function create(payload) {
  return ComingSoonContent.create(payload)
}

async function updateById(id, payload) {
  return ComingSoonContent.findByIdAndUpdate(id, payload, {
    new: true,
    runValidators: true
  })
}

module.exports = {
  findByKey,
  create,
  updateById
}
