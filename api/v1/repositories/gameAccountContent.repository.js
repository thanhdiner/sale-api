const GameAccountContent = require('../models/gameAccountContent.model')

async function findOne(options = {}) {
  let cursor = GameAccountContent.findOne({})

  if (options.lean) {
    cursor = cursor.lean()
  }

  return cursor
}

async function create(payload) {
  return GameAccountContent.create(payload)
}

async function updateById(id, payload) {
  return GameAccountContent.findByIdAndUpdate(id, payload, {
    new: true,
    runValidators: true
  })
}

module.exports = {
  findOne,
  create,
  updateById
}
