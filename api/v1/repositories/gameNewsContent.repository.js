const GameNewsContent = require('../models/gameNewsContent.model')

async function findOne(options = {}) {
  let cursor = GameNewsContent.findOne({})

  if (options.lean) {
    cursor = cursor.lean()
  }

  return cursor
}

async function create(payload) {
  return GameNewsContent.create(payload)
}

async function updateById(id, payload) {
  return GameNewsContent.findByIdAndUpdate(id, payload, {
    new: true,
    runValidators: true
  })
}

module.exports = {
  findOne,
  create,
  updateById
}
