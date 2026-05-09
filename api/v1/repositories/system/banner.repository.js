const Banner = require('../../models/system/banner.model')

async function findById(id) {
  return Banner.findById(id)
}

async function findAll(filter = {}, options = {}) {
  const { sort = { order: 1 } } = options
  return Banner.find(filter).sort(sort)
}

async function create(payload) {
  return Banner.create(payload)
}

async function updateById(id, payload, options = {}) {
  return Banner.findByIdAndUpdate(id, payload, {
    new: true,
    runValidators: true,
    ...options
  })
}

async function deleteById(id) {
  return Banner.findByIdAndDelete(id)
}

module.exports = {
  findById,
  findAll,
  create,
  updateById,
  deleteById
}










