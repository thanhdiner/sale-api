const Widget = require('../models/widgets.model')

async function findById(id) {
  return Widget.findById(id)
}

async function findOne(filter = {}, options = {}) {
  const { sort = {} } = options
  return Widget.findOne(filter).sort(sort)
}

async function findAll(filter = {}, options = {}) {
  const { sort = { order: 1 } } = options
  return Widget.find(filter).sort(sort)
}

async function create(payload) {
  return Widget.create(payload)
}

async function updateById(id, payload, options = {}) {
  return Widget.findByIdAndUpdate(id, payload, {
    new: true,
    runValidators: true,
    ...options
  })
}

async function deleteById(id) {
  return Widget.findByIdAndDelete(id)
}

module.exports = {
  findById,
  findOne,
  findAll,
  create,
  updateById,
  deleteById
}
