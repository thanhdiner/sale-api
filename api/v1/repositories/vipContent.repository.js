const VipContent = require('../models/vipContent.model')

async function findOne(options = {}) {
  let cursor = VipContent.findOne({})

  if (options.lean) {
    cursor = cursor.lean()
  }

  return cursor
}

async function create(payload) {
  return VipContent.create(payload)
}

async function updateById(id, payload) {
  return VipContent.findByIdAndUpdate(id, payload, {
    new: true,
    runValidators: true
  })
}

module.exports = {
  findOne,
  create,
  updateById
}
