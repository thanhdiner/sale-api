const CooperationContactContent = require('../models/cooperationContactContent.model')

async function findOne(options = {}) {
  let cursor = CooperationContactContent.findOne({})

  if (options.lean) {
    cursor = cursor.lean()
  }

  return cursor
}

async function create(payload) {
  return CooperationContactContent.create(payload)
}

async function updateById(id, payload) {
  return CooperationContactContent.findByIdAndUpdate(id, payload, {
    new: true,
    runValidators: true
  })
}

module.exports = {
  findOne,
  create,
  updateById
}
