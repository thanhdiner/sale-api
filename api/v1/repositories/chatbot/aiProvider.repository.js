const AIProvider = require('../../models/chatbot/aiProvider.model')

async function findAll(filter = {}, options = {}) {
  const { sort = { createdAt: -1 }, lean = false } = options
  let cursor = AIProvider.find(filter).sort(sort)

  if (lean) cursor = cursor.lean()

  return cursor
}

async function findById(id, options = {}) {
  let cursor = AIProvider.findById(id)

  if (options.lean) cursor = cursor.lean()

  return cursor
}

async function findOne(filter = {}, options = {}) {
  let cursor = AIProvider.findOne(filter)

  if (options.lean) cursor = cursor.lean()

  return cursor
}

async function create(payload) {
  return AIProvider.create(payload)
}

async function updateById(id, payload, options = {}) {
  return AIProvider.findByIdAndUpdate(id, payload, { new: true, runValidators: true, ...options })
}

async function deleteById(id) {
  return AIProvider.findByIdAndDelete(id)
}

module.exports = {
  findAll,
  findById,
  findOne,
  create,
  updateById,
  deleteById
}
