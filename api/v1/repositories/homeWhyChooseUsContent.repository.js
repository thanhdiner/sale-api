const HomeWhyChooseUsContent = require('../models/homeWhyChooseUsContent.model')

async function findOne(options = {}) {
  let cursor = HomeWhyChooseUsContent.findOne({})

  if (options.lean) {
    cursor = cursor.lean()
  }

  return cursor
}

async function create(payload) {
  return HomeWhyChooseUsContent.create(payload)
}

async function updateById(id, payload) {
  return HomeWhyChooseUsContent.findByIdAndUpdate(id, payload, {
    new: true,
    runValidators: true
  })
}

module.exports = {
  findOne,
  create,
  updateById
}
