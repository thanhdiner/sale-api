const AIAgent = require('../../models/chatbot/aiAgent.model')

async function findAll(filter = {}, options = {}) {
  const { sort = { sortOrder: 1, createdAt: 1 }, lean = false } = options
  let cursor = AIAgent.find(filter).sort(sort)
  if (lean) cursor = cursor.lean()
  return cursor
}

async function findById(id, options = {}) {
  let cursor = AIAgent.findById(id)
  if (options.lean) cursor = cursor.lean()
  return cursor
}

async function findOne(filter = {}, options = {}) {
  let cursor = AIAgent.findOne(filter)
  if (options.lean) cursor = cursor.lean()
  return cursor
}

async function create(payload) {
  return AIAgent.create(payload)
}

async function updateById(id, payload, options = {}) {
  return AIAgent.findByIdAndUpdate(id, payload, { new: true, runValidators: true, ...options })
}

async function updateMany(filter, payload) {
  return AIAgent.updateMany(filter, payload)
}

async function deleteById(id) {
  return AIAgent.findByIdAndDelete(id)
}

module.exports = {
  findAll,
  findById,
  findOne,
  create,
  updateById,
  updateMany,
  deleteById
}
